import * as core from '@actions/core'
import * as github from '@actions/github'
import { mocked } from 'jest-mock'

import { setupClaCheck } from '../src/setupClaCheck'
import getCommitters from '../src/graphql'
import prCommentSetup, { postUnlinkedAuthorsComment } from '../src/pullrequest/pullRequestComment'
import { getFileContent, createFile } from '../src/persistence/persistence'
import { isPersonalAccessTokenPresent, octokit } from '../src/octokit'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/graphql')
jest.mock('../src/pullrequest/pullRequestComment')
jest.mock('../src/persistence/persistence')
jest.mock('../src/pullRerunRunner')
jest.mock('../src/octokit', () => ({
  isPersonalAccessTokenPresent: jest.fn(),
  octokit: {
    repos: { createCommitStatus: jest.fn() },
    pulls: { get: jest.fn() }
  }
}))

const mockedGetCommitters = mocked(getCommitters)
const mockedPostUnlinkedAuthorsComment = mocked(postUnlinkedAuthorsComment)
const mockedPrCommentSetup = mocked(prCommentSetup)
const mockedGetFileContent = mocked(getFileContent)
const mockedCreateFile = mocked(createFile)
const mockedIsPersonalAccessTokenPresent = mocked(isPersonalAccessTokenPresent)
const mockedCreateCommitStatus = mocked(octokit.repos.createCommitStatus)
const mockedGetInput = mocked(core.getInput)

describe('setupClaCheck - unlinked commit author preliminary check', () => {

  beforeEach(() => {
    mockedIsPersonalAccessTokenPresent.mockReturnValue(true)
    mockedCreateCommitStatus.mockResolvedValue({} as any)
    mockedPostUnlinkedAuthorsComment.mockResolvedValue(undefined)
    mockedPrCommentSetup.mockResolvedValue(undefined)
    mockedCreateFile.mockResolvedValue({} as any)

    mockedGetInput.mockImplementation((name: string) => {
      if (name === 'allowlist') return 'user1,bot*'
      if (name === 'use-mlcommons-flag') return 'true'
      return ''
    })

    // @ts-ignore
    github.context = {
      eventName: 'pull_request_target',
      payload: {
        action: 'opened',
        pull_request: { head: { sha: 'headsha123' } }
      },
      repo: { owner: 'mlcommons', repo: 'endpoints_policies' },
      issue: { owner: 'mlcommons', repo: 'endpoints_policies', number: 105 }
    }
  })

  test('reports every commit with an unlinked author and never proceeds to the CLA signature checks', async () => {
    const unlinkedCommit = {
      sha: '585309d91436e46f98c9a50c31c16a932f40676e',
      name: 'anandhu-eng',
      email: 'aiwizardcommon@gmail.com'
    }
    mockedGetCommitters.mockResolvedValue({
      committers: [],
      unlinkedCommits: [unlinkedCommit]
    })

    await setupClaCheck()

    expect(mockedPostUnlinkedAuthorsComment).toHaveBeenCalledWith([unlinkedCommit])
    expect(mockedGetFileContent).not.toHaveBeenCalled()
    expect(mockedPrCommentSetup).not.toHaveBeenCalled()
    expect(mockedCreateCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failure',
        description: expect.stringContaining('not linked to a GitHub account')
      })
    )
    expect(core.setFailed).toHaveBeenCalled()
  })

  test('does not short-circuit when the unlinked commit author is in the allowlist', async () => {
    mockedGetCommitters.mockResolvedValue({
      committers: [{ name: 'realuser', id: 123, pullRequestNo: 105 } as any],
      unlinkedCommits: [{ sha: 'abc1234', name: 'bot*', email: 'bot@example.com' }]
    })
    mockedGetFileContent.mockResolvedValue({
      data: {
        sha: 'filesha',
        content: Buffer.from(JSON.stringify({ signedContributors: [{ id: 123 }] })).toString('base64')
      }
    } as any)

    await setupClaCheck()

    expect(mockedPostUnlinkedAuthorsComment).not.toHaveBeenCalled()
    expect(mockedGetFileContent).toHaveBeenCalled()
    expect(mockedPrCommentSetup).toHaveBeenCalledWith(true, expect.anything(), expect.anything())
  })
})
