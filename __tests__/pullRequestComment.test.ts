import * as core from '@actions/core'
import * as github from '@actions/github'
import { mocked } from 'jest-mock'

import prCommentSetup from '../src/pullrequest/pullRequestComment'
import { octokit } from '../src/octokit'
import { CommitterMap } from '../src/interfaces'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/octokit', () => ({
  octokit: {
    issues: {
      listComments: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn()
    }
  }
}))

const mockedListComments = mocked(octokit.issues.listComments)
const mockedUpdateComment = mocked(octokit.issues.updateComment)
const mockedGetInput = mocked(core.getInput)

describe('prCommentSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockedGetInput.mockImplementation((name: string) => {
      if (name === 'use-mlcommons-flag') return 'true'
      return ''
    })

    // @ts-ignore
    github.context = {
      repo: { owner: 'mlcommons', repo: 'training_policies' },
      issue: { owner: 'mlcommons', repo: 'training_policies', number: 594 }
    }
  })

  test('replaces a stale unlinked-author comment with the regular not-signed message even though signed is false', async () => {
    const staleUnlinkedAuthorsComment = {
      id: 42,
      body: '**MLCommons CLA bot:** :warning: This pull request cannot be checked for CLA signatures because the following commit(s) have an author that is not linked to any GitHub account...'
    }
    mockedListComments.mockResolvedValue({ data: [staleUnlinkedAuthorsComment] } as any)
    mockedUpdateComment.mockResolvedValue({} as any)

    const committerMap: CommitterMap = {
      signed: [],
      notSigned: [{ name: 'realuser', id: 123, pullRequestNo: 594 }]
    }

    await prCommentSetup(false, committerMap, committerMap.notSigned!)

    expect(mockedUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 42,
        body: expect.stringContaining('MLCommons CLA bot')
      })
    )
    const postedBody = mockedUpdateComment.mock.calls[0][0]!.body as string
    expect(postedBody).not.toContain('not linked to any GitHub account')
  })
})
