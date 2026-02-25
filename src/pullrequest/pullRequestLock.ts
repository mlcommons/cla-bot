import { octokit } from '../octokit'
import * as core from '@actions/core'
import { context } from '@actions/github'

export async function lockPullRequest() {
    core.info('Locking the Pull Request to safe guard the Pull Request CLA Signatures')
    const pullRequestNo: number = context.issue.number
    core.info(`Calling GitHub API to lock issue/PR #${pullRequestNo} in ${context.repo.owner}/${context.repo.repo}`)
    try {
        await octokit.issues.lock(
            {
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: pullRequestNo
            }
        )
        core.info(`Successfully locked pull request #${pullRequestNo}`)
    } catch (e) {
        core.error(`Failed to lock pull request #${pullRequestNo}: ${e.message}`)
        core.error(`Lock error status: ${e.status || 'unknown'}`)
    }
}