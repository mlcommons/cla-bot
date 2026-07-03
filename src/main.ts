import { context } from '@actions/github'
import { setupClaCheck } from './setupClaCheck'

import * as core from '@actions/core'



export async function run() {
  try {
    core.info(`MLCommons CLA bot has started the process - v5`)
    core.info(`Event: ${context.eventName}, Action: ${context.payload.action}, PR: #${context.issue.number}`)
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`)

    if (context.payload.action === 'closed') {
      core.info(`PR #${context.issue.number} is closed - skipping CLA check`)
    } else {
      core.info(`PR #${context.issue.number} is open - proceeding to CLA check`)
      await setupClaCheck()
      core.info(`CLA check flow complete for PR #${context.issue.number}`)
    }
  } catch (error) {
    core.error(`Unhandled error in run(): ${error.message}`)
    core.setFailed(error.message)
  }
}

run().catch(error => {
  core.error(`Fatal unhandled rejection: ${error.message}`)
  core.setFailed(error.message)
  process.exit(1)
})
