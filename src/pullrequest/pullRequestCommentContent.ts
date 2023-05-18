import {
    CommitterMap
} from '../interfaces'
import * as input from '../shared/getInputs'
import * as core from '@actions/core'

export function commentContent(signed: boolean, committerMap: CommitterMap): string {
    // using a `string` true or false purposely as github action input cannot have a boolean value
    if (input.getUseMLCommonsFlag() == 'true') {
        core.info(`MLCommons bot has started the PR Comment.`)
        return mlcommons(signed, committerMap)
    } else {
        core.error(`ERROR: This function getUseMLCommonsFlag() returned false.`)
        if (input.getUseDcoFlag() == 'true') {
            return dco(signed, committerMap)
        } else {
            return cla(signed, committerMap)
        }
    }
}

function mlcommons(signed: boolean, committerMap: CommitterMap): string {

    if (signed) {
        const line1 = input.getCustomAllSignedPrComment() || `All contributors have signed the MLCommons CLA  ✍️ ✅`
        const text = `****MLCommons CLA bot**** ${line1}`
        return text
    }
    let committersCount = 1

    if (committerMap && committerMap.signed && committerMap.notSigned) {
        committersCount = committerMap.signed.length + committerMap.notSigned.length

    }

    let you = committersCount > 1 ? `you all` : `you`
    let message = `<br/>Thank you very much for your submission, we really appreciate it. Before we can accept your contribution, 
    we ask that you sign the MLCommons CLA (Apache 2). Please use this [Google form]([LINK_TO_DOC]) to initiate 
    authorization. If you are from an MLCommons member organization, we will request that you be added to the CLA. 
    If you are not from a member organization, we will email you a CLA to sign. For any questions, please contact 
    support@mlcommons.org.<br/>`
    let path_to_document = "https://forms.gle/Ew1KkBVpyeJDuRw67"
    let lineOne = message.replace("[LINK_TO_DOC]", path_to_document).replace('$you', you)
    let text = `**MLCommons CLA bot:** ${lineOne}`

    if (committersCount >= 1 && committerMap && committerMap.signed && committerMap.notSigned) {
        text += `**${committerMap.signed.length}** out of **${committerMap.signed.length + committerMap.notSigned.length}** committers have signed the MLCommons CLA.`
        committerMap.signed.forEach(signedCommitter => { text += `<br/>:white_check_mark: @${signedCommitter.name}` })
        committerMap.notSigned.forEach(unsignedCommitter => {
            text += `<br/>:x: @${unsignedCommitter.name}`
        })
        text += '<br/>'
    }

    if (committerMap && committerMap.unknown && committerMap.unknown.length > 0) {
        let seem = committerMap.unknown.length > 1 ? "seem" : "seems"
        let committerNames = committerMap.unknown.map(committer => committer.name)
        text += `**${committerNames.join(", ")}** ${seem} not to be a GitHub user.`
        text += ' You need a GitHub account after you become MLCommons member. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/>'
    }

    text += '<sub>You can retrigger this bot by commenting **recheck** in this Pull Request</sub>'
    return text
}

function dco(signed: boolean, committerMap: CommitterMap): string {
    core.error(`ERROR: This function dco() should not be called in MLCommons bot.`)

    if (signed) {
        const line1 = input.getCustomAllSignedPrComment() || `All contributors have signed the DCO  ✍️ ✅`
        const text = `****DCO Assistant Lite bot**** ${line1}`
        return text
    }
    let committersCount = 1

    if (committerMap && committerMap.signed && committerMap.notSigned) {
        committersCount = committerMap.signed.length + committerMap.notSigned.length

    }

    let you = committersCount > 1 ? `you all` : `you`
    let lineOne = (input.getCustomNotSignedPrComment() || `<br/>Thank you for your submission, we really appreciate it. Like many open-source projects, we ask that $you sign our [Developer Certificate of Origin](${input.getPathToDocument()}) before we can accept your contribution. You can sign the DCO by just posting a Pull Request Comment same as the below format.<br/>`).replace('$you', you)
    let text = `**DCO Assistant Lite bot:** ${lineOne}
   - - -
   ***${input.getCustomPrSignComment() || "I have read the DCO Document and I hereby sign the DCO"} ***
   - - -
   `

    if (committersCount > 1 && committerMap && committerMap.signed && committerMap.notSigned) {
        text += `**${committerMap.signed.length}** out of **${committerMap.signed.length + committerMap.notSigned.length}** committers have signed the DCO.`
        committerMap.signed.forEach(signedCommitter => { text += `<br/>:white_check_mark: @${signedCommitter.name}` })
        committerMap.notSigned.forEach(unsignedCommitter => {
            text += `<br/>:x: @${unsignedCommitter.name}`
        })
        text += '<br/>'
    }

    if (committerMap && committerMap.unknown && committerMap.unknown.length > 0) {
        let seem = committerMap.unknown.length > 1 ? "seem" : "seems"
        let committerNames = committerMap.unknown.map(committer => committer.name)
        text += `**${committerNames.join(", ")}** ${seem} not to be a GitHub user.`
        text += ' You need a GitHub account to be able to sign the DCO. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/>'
    }

    text += '<sub>You can retrigger this bot by commenting **recheck** in this Pull Request</sub>'
    return text
}

function cla(signed: boolean, committerMap: CommitterMap): string {
    core.error(`ERROR: This function cla() should not be called in MLCommons bot.`)

    if (signed) {
        const line1 = input.getCustomAllSignedPrComment() || `All contributors have signed the CLA  ✍️ ✅`
        const text = `****CLA Assistant Lite bot**** ${line1}`
        return text
    }
    let committersCount = 1

    if (committerMap && committerMap.signed && committerMap.notSigned) {
        committersCount = committerMap.signed.length + committerMap.notSigned.length

    }

    let you = committersCount > 1 ? `you all` : `you`
    let lineOne = (input.getCustomNotSignedPrComment() || `<br/>Thank you for your submission, we really appreciate it. Like many open-source projects, we ask that $you sign our [Contributor License Agreement](${input.getPathToDocument()}) before we can accept your contribution. You can sign the CLA by just posting a Pull Request Comment same as the below format.<br/>`).replace('$you', you)
    let text = `**CLA Assistant Lite bot:** ${lineOne}
   - - -
   ***${input.getCustomPrSignComment() || "I have read the CLA Document and I hereby sign the CLA"}***
   - - -
   `

    if (committersCount > 1 && committerMap && committerMap.signed && committerMap.notSigned) {
        text += `**${committerMap.signed.length}** out of **${committerMap.signed.length + committerMap.notSigned.length}** committers have signed the CLA.`
        committerMap.signed.forEach(signedCommitter => { text += `<br/>:white_check_mark: @${signedCommitter.name}` })
        committerMap.notSigned.forEach(unsignedCommitter => {
            text += `<br/>:x: @${unsignedCommitter.name}`
        })
        text += '<br/>'
    }

    if (committerMap && committerMap.unknown && committerMap.unknown.length > 0) {
        let seem = committerMap.unknown.length > 1 ? "seem" : "seems"
        let committerNames = committerMap.unknown.map(committer => committer.name)
        text += `**${committerNames.join(", ")}** ${seem} not to be a GitHub user.`
        text += ' You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/>'
    }

    text += '<sub>You can retrigger this bot by commenting **recheck** in this Pull Request</sub>'
    return text
}
