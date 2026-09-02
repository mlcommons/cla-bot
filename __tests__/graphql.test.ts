import * as github from '@actions/github'
import { mocked } from 'jest-mock'

import getCommitters from '../src/graphql'
import { octokit } from '../src/octokit'

jest.mock('@actions/github')
jest.mock('../src/octokit', () => ({
  octokit: {
    graphql: jest.fn(),
    repos: { getCommit: jest.fn() }
  }
}))

jest.setTimeout(20000)

const mockedGraphql = mocked(octokit.graphql)
const mockedGetCommit = mocked(octokit.repos.getCommit)

function commitsResponse(nodes: any[]) {
  return {
    repository: {
      pullRequest: {
        commits: {
          totalCount: nodes.length,
          edges: nodes.map(node => ({ node: { commit: node }, cursor: '' })),
          pageInfo: { endCursor: '', hasNextPage: false }
        }
      }
    }
  }
}

const linkedNode = {
  oid: 'sha-linked',
  author: { email: 'a@example.com', name: 'A', user: { id: 'gid', databaseId: 1, login: 'alice' } },
  committer: { email: 'a@example.com', name: 'A', user: null }
}

function unresolvedNode(sha: string) {
  return {
    oid: sha,
    author: { email: 'pavan@mlcommons.org', name: 'Pavan Yalamanchili', user: null },
    committer: { email: 'pavan@mlcommons.org', name: 'Pavan Yalamanchili', user: null }
  }
}

describe('getCommitters - transient unresolved author handling', () => {
  beforeEach(() => {
    // @ts-ignore
    github.context = {
      repo: { owner: 'mlcommons', repo: 'training_policies' },
      issue: { owner: 'mlcommons', repo: 'training_policies', number: 594 }
    }
  })

  test('resolves immediately with no retries when GraphQL links the author', async () => {
    mockedGraphql.mockResolvedValue(commitsResponse([linkedNode]))

    const result = await getCommitters()

    expect(mockedGraphql).toHaveBeenCalledTimes(1)
    expect(mockedGetCommit).not.toHaveBeenCalled()
    expect(result.unlinkedCommits).toEqual([])
    expect(result.committers).toEqual([{ name: 'alice', id: 1, pullRequestNo: 594 }])
  })

  test('resolves a commit that only becomes linked on a GraphQL retry (transient indexing lag)', async () => {
    mockedGraphql
      .mockResolvedValueOnce(commitsResponse([unresolvedNode('sha-lagging')]))
      .mockResolvedValueOnce(commitsResponse([{
        oid: 'sha-lagging',
        author: { email: 'pavan@mlcommons.org', name: 'Pavan Yalamanchili', user: { id: 'gid2', databaseId: 364829, login: 'pavanky' } },
        committer: { email: 'pavan@mlcommons.org', name: 'Pavan Yalamanchili', user: null }
      }]))

    const result = await getCommitters()

    expect(mockedGraphql).toHaveBeenCalledTimes(2)
    expect(mockedGetCommit).not.toHaveBeenCalled()
    expect(result.unlinkedCommits).toEqual([])
    expect(result.committers).toEqual([{ name: 'pavanky', id: 364829, pullRequestNo: 594 }])
  })

  test('falls back to the REST commit endpoint when GraphQL never resolves the author', async () => {
    mockedGraphql.mockResolvedValue(commitsResponse([unresolvedNode('sha-rest-only')]))
    mockedGetCommit.mockResolvedValue({ data: { author: { login: 'pavanky', id: 364829 }, committer: null } } as any)

    const result = await getCommitters()

    // 1 initial + RESOLUTION_RETRIES retries
    expect(mockedGraphql).toHaveBeenCalledTimes(3)
    expect(mockedGetCommit).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'mlcommons', repo: 'training_policies', ref: 'sha-rest-only' })
    )
    expect(result.unlinkedCommits).toEqual([])
    expect(result.committers).toEqual([{ name: 'pavanky', id: 364829, pullRequestNo: 594 }])
  })

  test('reports the commit as unlinked only when both GraphQL and the REST fallback fail to resolve it', async () => {
    mockedGraphql.mockResolvedValue(commitsResponse([unresolvedNode('sha-truly-unlinked')]))
    mockedGetCommit.mockResolvedValue({ data: { author: null, committer: null } } as any)

    const result = await getCommitters()

    expect(result.committers).toEqual([])
    expect(result.unlinkedCommits).toEqual([{
      sha: 'sha-truly-unlinked',
      name: 'Pavan Yalamanchili',
      email: 'pavan@mlcommons.org'
    }])
  })
})
