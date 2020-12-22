import { checkAllowList } from './checkAllowList'
import getCommitters from './graphql'
import prCommentSetup from './pullrequest/pullRequestComment'
import { printCommitterMap, printCommittersDetails } from './pullrequest/pullRequestComment'
import { CommitterMap, CommittersDetails, ReactedCommitterMap, ClafileContentAndSha } from './interfaces'
import { context } from '@actions/github'
import { createFile, getFileContent, updateFile } from './persistence/persistence'
import { reRunLastWorkFlowIfRequired } from './pullRerunRunner'
import { isPersonalAccessTokenPresent } from './octokit'

import * as _ from 'lodash'
import * as core from '@actions/core'

export async function setupClaCheck() {

  let committerMap = getInitialCommittersMap()
  if (!isPersonalAccessTokenPresent()) {
    core.setFailed('Please enter a personal access token as a environment variable in the CLA workflow file as described in the https://github.com/cla-assistant/github-action documentation')
    return
  }
  let signed: boolean = false, response
  let committers = await getCommitters() as CommittersDetails[]
  core.info(`Found following users in PR: ${printCommittersDetails(committers)}`)
  committers = checkAllowList(committers) as CommittersDetails[]
  core.info(`Found following users(-allowlist) in PR: ${printCommittersDetails(committers)}`)

  try {
    response = await getCLAFileContentandSHA(committers, committerMap) as ClafileContentAndSha
  } catch (error) {
    core.setFailed(error)
    return
  }
  const claFileContent = response?.claFileContent
  const sha: string = response?.sha

  committerMap = prepareCommiterMap(committers, claFileContent) as CommitterMap
  core.info(`Created a committerMap for users in PR: ${printCommitterMap(committerMap)}`)

  if (committerMap?.notSigned && committerMap?.notSigned.length === 0) {
    signed = true
    core.info(`Found all users to have signed CLA`)
  }
  try {
    // BROKEN !!!!!!!!!!
    // moving to after signed check
    ///const reactedCommitters: any = (await prCommentSetup(signed, committerMap, committers)) as ReactedCommitterMap
    await prCommentSetup(signed, committerMap, committers)

    if (signed) {
      core.info(`All committers have signed the CLA`)
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
  committers.map(committer => {
    if (!committer.id) {
      committerMap.unknown.push(committer)
    }
  })

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
  committers.map(committer => {
    if (!committer.id) {
      committerMap.unknown.push(committer)
    }
  })
  return committerMap
}

const getInitialCommittersMap = (): CommitterMap => ({
  signed: [],
  notSigned: [],
  unknown: []
})

export function printUnsignedCommitter(committers: CommittersDetails[]): string {
  let text = '('
  for (const i of committers) {
    text += i.name
    text += ', '
  }
  text += ')'
  return text
}