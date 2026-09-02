import { checkAllowList } from './checkAllowList'
import getCommitters from './graphql'
import prCommentSetup, { postUnlinkedAuthorsComment } from './pullrequest/pullRequestComment'
import { printCommitterMap, printCommittersDetails } from './pullrequest/pullRequestComment'
import { CommitterMap, CommittersDetails, ReactedCommitterMap, ClafileContentAndSha, UnlinkedCommitDetails } from './interfaces'
import { context } from '@actions/github'
import { createFile, getFileContent, updateFile } from './persistence/persistence'
import { reRunLastWorkFlowIfRequired } from './pullRerunRunner'
import { isPersonalAccessTokenPresent, octokit } from './octokit'

import * as _ from 'lodash'
import * as core from '@actions/core'

export async function setupClaCheck() {

  core.info(`Starting CLA check for PR #${context.issue.number}`)
  let committerMap = getInitialCommittersMap()
  if (!isPersonalAccessTokenPresent()) {
    core.setFailed('Please enter a personal access token as a environment variable in the CLA workflow file as described in the https://github.com/cla-assistant/github-action documentation')
    return
  }
  let signed: boolean = false, response
  core.info(`Fetching committers for PR #${context.issue.number}`)
  const { committers: rawCommitters, unlinkedCommits: rawUnlinkedCommits } = await getCommitters()
  core.info(`Found ${rawCommitters.length} committer(s) in PR: ${printCommittersDetails(rawCommitters)}`)
  if (rawUnlinkedCommits.length > 0) {
    core.info(`Found ${rawUnlinkedCommits.length} commit(s) with an author not linked to a GitHub account: ${printUnlinkedCommits(rawUnlinkedCommits)}`)
  }

  const unlinkedCommits = checkAllowList(rawUnlinkedCommits)
  if (unlinkedCommits.length > 0) {
    core.info(`This is a preliminary check that runs before CLA signatures are evaluated - the CLA check cannot proceed while any commit has an unlinked author.`)
    core.info(`Commit(s) with an author not linked to a GitHub account: ${printUnlinkedCommits(unlinkedCommits)}`)
    try {
      await postUnlinkedAuthorsComment(unlinkedCommits)
      await reportClaStatus(false, 'One or more commit authors are not linked to a GitHub account - see PR comment')
    } catch (err) {
      core.setFailed(`Could not report unlinked commit authors: ${err.message}`)
      return
    }
    core.setFailed(`Pull request number ${context.issue.number} has commit(s) with an author not linked to a GitHub account; CLA signatures cannot be verified until this is fixed`)
    return
  }
  core.info(`All commits have an author linked to a GitHub account - proceeding to CLA signature checks`)

  let committers = checkAllowList(rawCommitters)
  core.info(`After allowlist filter: ${committers.length} committer(s) remaining: ${printCommittersDetails(committers)}`)

  core.info(`Fetching CLA file content and SHA`)
  try {
    response = await getCLAFileContentandSHA(committers, committerMap) as ClafileContentAndSha
  } catch (error) {
    core.setFailed(error)
    return
  }
  const claFileContent = response?.claFileContent
  const sha: string = response?.sha
  core.info(`CLA file retrieved (SHA: ${sha})`)

  committerMap = prepareCommiterMap(committers, claFileContent) as CommitterMap
  core.info(`CommitterMap: ${printCommitterMap(committerMap)}`)
  core.info(`Signed: ${committerMap.signed?.length || 0}, Not signed: ${committerMap.notSigned?.length || 0}`)

  if (committerMap?.notSigned && committerMap?.notSigned.length === 0) {
    signed = true
    core.info(`All users have signed the CLA`)
  } else {
    core.info(`${committerMap.notSigned?.length || 0} user(s) have not signed the CLA`)
  }
  try {
    core.info(`Setting up PR comment (signed=${signed})`)
    await prCommentSetup(signed, committerMap, committers)
    core.info(`PR comment setup complete`)

    core.info(`Reporting cla-check commit status: ${signed ? 'success' : 'failure'}`)
    await reportClaStatus(signed)
    core.info(`cla-check commit status reported`)

    if (signed) {
      core.info(`All committers have signed the CLA - checking if workflow rerun is needed`)
      return reRunLastWorkFlowIfRequired()
    }
    
    // subin commented below line for mlcommons-bot since we don't update json file from bot
    // if (reactedCommitters?.newSigned.length) {
    //   /* pushing the recently signed  contributors to the CLA Json File */
    //   await updateFile(sha, claFileContent, reactedCommitters)
    // }
    // if (reactedCommitters?.allSignedFlag) {
    //   core.info(`All contributors have signed the CLA`)
    //   return reRunLastWorkFlowIfRequired()
    // }

    if (committerMap?.notSigned === undefined || committerMap.notSigned.length === 0) {
      core.info(`All contributors have signed the CLA`)
      return reRunLastWorkFlowIfRequired()
    } else {
      core.setFailed(`committers of Pull Request number ${context.issue.number} have to sign the CLA`)
      core.info(`Found following users in PR who have not signed CLA: ${printUnsignedCommitter(committerMap.notSigned)}`)
    }
  } catch (err) {
    core.setFailed(`Could not update the JSON file: ${err.message}`)
  }

}

async function getCLAFileContentandSHA(committers: CommittersDetails[], committerMap: CommitterMap): Promise<any> {
  let result, claFileContentString, claFileContent, sha
  try {
    result = await getFileContent()
  } catch (error) {
    if (error.status === 404) {
      await createClaFileAndPRComment(committers, committerMap)
      return
    } else {
      core.setFailed(`Could not retrieve repository contents: ${error.message}. Status: ${error.status || 'unknown'}`)
    }
  }
  sha = result?.data?.sha
  claFileContentString = Buffer.from(result.data.content, 'base64').toString()
  claFileContent = JSON.parse(claFileContentString)
  return { claFileContent: claFileContent, sha: sha } as ClafileContentAndSha
}

async function createClaFileAndPRComment(committers: CommittersDetails[], committerMap: CommitterMap): Promise<any> {
  const signed = false
  committerMap.notSigned = committers
  committerMap.signed = []

  const initialContent = { signedContributors: [] }
  const initialContentString = JSON.stringify(initialContent, null, 3)
  const initialContentBinary = Buffer.from(initialContentString).toString('base64')

  await createFile(initialContentBinary).catch(error => core.setFailed(
    `Error occurred when creating the signed contributors file: ${error.message || error}. Make sure the branch where signatures are stored is NOT protected.`
  ))
  await prCommentSetup(signed, committerMap, committers)
  throw new Error(`Committers of pull request ${context.issue.number} have to sign the CLA`)
}

function prepareCommiterMap(committers: CommittersDetails[], claFileContent): CommitterMap {

  let committerMap = getInitialCommittersMap()

  committerMap.notSigned = committers.filter(
    committer => !claFileContent.signedContributors.some(cla => committer.id === cla.id)
  )
  committerMap.signed = committers.filter(committer =>
    claFileContent.signedContributors.some(cla => committer.id === cla.id)
  )
  return committerMap
}

const getInitialCommittersMap = (): CommitterMap => ({
  signed: [],
  notSigned: []
})

async function reportClaStatus(signed: boolean, description?: string): Promise<void> {
  let sha: string
  if (context.payload.pull_request?.head?.sha) {
    sha = context.payload.pull_request.head.sha as string
  } else {
    const pr = await octokit.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.issue.number
    })
    sha = pr.data.head.sha
  }
  await octokit.repos.createCommitStatus({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    state: signed ? 'success' : 'failure',
    context: 'cla-check',
    description: description || (signed ? 'All contributors have signed the CLA' : 'Please sign the MLCommons CLA')
  })
}

export function printUnsignedCommitter(committers: CommittersDetails[]): string {
  let text = '('
  for (const i of committers) {
    text += i.name
    text += ' (id:'
    text += i.id
    text += '), '
  }
  text += ')'
  return text
}

export function printUnlinkedCommits(unlinkedCommits: UnlinkedCommitDetails[]): string {
  let text = '('
  for (const c of unlinkedCommits) {
    text += `commit ${c.sha}: name="${c.name}", email="${c.email}"`
    text += ', '
  }
  text += ')'
  return text
}