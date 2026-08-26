import * as github from '@actions/github'
import { setupClaCheck } from '../src/setupClaCheck'
import { run } from '../src/main'
import { mocked } from 'jest-mock'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/setupClaCheck')
const mockedSetupClaCheck = mocked(setupClaCheck)


describe('Pull request event', () => {

  beforeEach(async () => {
    // @ts-ignore
    github.context = {
      eventName: 'pull_request',
      ref: 'refs/pull/232/merge',
      workflow: 'CLA Assistant',
      action: 'ibakshaygithub-action-1',
      actor: 'ibakshay',
      payload: {
        action: 'closed',
        number: '1',
        pull_request: {
          number: 1,
          title: 'test',
          user: {
            login: 'ibakshay',
          },
        },
        repository: {
          name: 'auto-assign',
          owner: {
            login: 'ibakshay',
          },
        },
      },
      repo: {
        owner: 'ibakshay',
        repo: 'auto-assign',
      },
      issue: {
        owner: 'kentaro-m',
        repo: 'auto-assign',
        number: 1,
      },
      sha: ''
    }

  }
  )

  test('the setupClaCheck method should not be called if there is a pull request merge/closed', async () => {

    await run()
    expect(mockedSetupClaCheck).not.toHaveBeenCalled()
  })

  test('the setupClaCheck method should be called if there is a pull request opened', async () => {

    github.context.payload.action = 'opened'
    await run()
    expect(mockedSetupClaCheck).toHaveBeenCalled()

  })

  test('the setupClaCheck method should be called if there is a pull request sync', async () => {
    github.context.payload.action = 'synchronize'
    await run()
    expect(mockedSetupClaCheck).toHaveBeenCalled()

  })


})
