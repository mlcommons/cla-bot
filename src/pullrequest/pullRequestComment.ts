import { octokit } from '../octokit'
import { context } from '@actions/github'
import signatureWithPRComment from './signatureComment'
import { commentContent } from './pullRequestCommentContent'
import {
  CommitterMap,
  ReactedCommitterMap,
  CommittersDetails
} from '../interfaces'
import { getUseDcoFlag, getUseMLCommonsFlag } from '../shared/getInputs'
import * as core from '@actions/core'

export default async function prCommentSetup(signed: boolean, committerMap: CommitterMap, committers: CommittersDetails[]) {
  try {
    const claBotComment = await getComment()
    if (!claBotComment) {
      core.info(`MLCommons bot has not created a PR Comment so far.`)
      return createComment(signed, committerMap)
    } else if (claBotComment?.id) {
      if (signed) {
        await updateComment(signed, committerMap, claBotComment)
      }

      // reacted committers are contributors who have newly signed by posting the Pull Request comment
      // subin commented below line for mlcommons-bot
      // const reactedCommitters: ReactedCommitterMap = (await signatureWithPRComment(committerMap, committers)) as ReactedCommitterMap
      // core.info(`reactedCommitters:  ${printReactedCommitterMap(reactedCommitters)}`)
      // // const reactedCommitters: ReactedCommitterMap = {} as ReactedCommitterMap
      // // end of subin's changes
      // if (reactedCommitters) {
      //   if (reactedCommitters.onlyCommitters) {
      //     reactedCommitters.allSignedFlag = prepareAllSignedCommitters(committerMap, reactedCommitters.onlyCommitters, committers)
      //   }
      // }
      // core.info(`committerMap:  ${printCommitterMap(committerMap)}`)
      // core.info(`reactedCommitters:  ${printReactedCommitterMap(reactedCommitters)}`)
      // committerMap = prepareCommiterMap(committerMap, reactedCommitters)
      // core.info(`committerMap:  ${printCommitterMap(committerMap)}`)
      // await updateComment(reactedCommitters.allSignedFlag, committerMap, claBotComment)
      // return reactedCommitters
    }
  } catch (error) {
    throw new Error(
      `Error occured when creating or editing the comments of the pull request: ${error.message}`)
  }
}

async function createComment(signed: boolean, committerMap: CommitterMap): Promise<void> {
  await octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: commentContent(signed, committerMap)
  }).catch(error => { throw new Error(`Error occured when creating a pull request comment: ${error.message}`) })
}

async function updateComment(signed: boolean, committerMap: CommitterMap, claBotComment: any): Promise<void> {
  await octokit.issues.updateComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    comment_id: claBotComment.id,
    body: commentContent(signed, committerMap)
  }).catch(error => { throw new Error(`Error occured when getting  all the comments of the pull request: ${error.message}`) })
}

async function getComment() {
  try {
    const response = await octokit.issues.listComments({ owner: context.repo.owner, repo: context.repo.repo, issue_number: context.issue.number })

    //TODO: check the below regex
    // using a `string` true or false purposely as github action input cannot have a boolean value
    if (getUseMLCommonsFlag() === 'true') {
      let comment = response.data.find(comment => comment.body.match(/.*MLCommons CLA bot.*/))
      core.info(`MLCommons CLA bot comment id:  ${comment?.id}`)
      return response.data.find(comment => comment.body.match(/.*MLCommons CLA bot.*/))
    } else {
      core.error(`ERROR: This function getComment() should not be called in MLCommons bot.`)
      if (getUseDcoFlag() === 'true') {
        return response.data.find(comment => comment.body.match(/.*DCO Assistant Lite bot.*/))
      } else if (getUseDcoFlag() === 'false') {
        return response.data.find(comment => comment.body.match(/.*CLA Assistant Lite bot.*/))
  
      }
    }
  } catch (error) {
    throw new Error(`Error occured when getting  all the comments of the pull request: ${error.message}`)
  }
}

function prepareCommiterMap(committerMap: CommitterMap, reactedCommitters) {
  committerMap.signed?.push(...reactedCommitters.newSigned)
  committerMap.notSigned = committerMap.notSigned!.filter(
    committer =>
      !reactedCommitters.newSigned.some(
        reactedCommitter => committer.id === reactedCommitter.id
      )
  )
  return committerMap

}

function prepareAllSignedCommitters(committerMap: CommitterMap, signedInPrCommitters: CommittersDetails[], committers: CommittersDetails[]): boolean {
  let allSignedCommitters = [] as CommittersDetails[]
  /*
1) already signed committers in the file 2) signed committers in the PR comment
    */
  let ids = new Set(signedInPrCommitters.map(committer => committer.id))
  allSignedCommitters = [...signedInPrCommitters, ...committerMap.signed!.filter(signedCommitter => !ids.has(signedCommitter.id))]

  //checking if all the unsigned committers have reacted to the PR comment (this is needed for changing the content of the PR comment to "All committers have signed the CLA")
  let allSignedFlag: boolean = committers.every(committer => allSignedCommitters.some(reactedCommitter => committer.id === reactedCommitter.id))
  return allSignedFlag
}

export function printCommittersDetails(committers: CommittersDetails[]): string {
  let text = ''
  for (const ic of committers) {
    text += ic.name
    text += '-'
    text += ic.id
    text += ', '
  }
  return text
}

export function printCommitterMap(committers: CommitterMap): string {
  let signed = committers.signed || []
  let notSigned = committers.notSigned || []
  let unknown = committers.unknown || []
  let text = '(signed: '
  for (const i of signed) {
    text += i.name
    text += '-'
    text += i.id
    text += ', '
  }
  text += ') , (notSigned:  '
  for (const j of notSigned) {
    text += j.name
    text += '-'
    text += j.id
    text += ', '
  }
  text += ')'
  return text
}

export function printReactedCommitterMap(committers: ReactedCommitterMap): string {
  let signed = committers.newSigned || []
  let onlycommiters = committers.onlyCommitters || []
  let allSignedFlag = committers.allSignedFlag
  let text = '(newSigned: '
  for (const i of signed) {
    text += i.name
    text += '-'
    text += i.id
    text += ', '
  }
  text += ') , (onlyCommitters:  '
  for (const j of onlycommiters) {
    text += j.name
    text += '-'
    text += j.id
    text += ', '
  }
  text += ')'
  return text
}
