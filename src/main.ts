import { context } from '@actions/github'
import { setupClaCheck } from './setupClaCheck'
import { lockPullRequest } from './pullrequest/pullRequestLock'

import * as core from '@actions/core'



export async function run() {
  try {
    core.info(`MLCommons CLA bot has started the process - v5`)

    if (context.payload.action === 'closed') {
      return lockPullRequest()
    } else {
      await setupClaCheck()
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
