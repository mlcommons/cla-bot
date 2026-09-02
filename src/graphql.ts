import { octokit } from './octokit'
import { context } from '@actions/github'
import { CommittersDetails, UnlinkedCommitDetails } from './interfaces'
import * as core from '@actions/core'

export interface GetCommittersResult {
    committers: CommittersDetails[]
    unlinkedCommits: UnlinkedCommitDetails[]
}

// GitHub's GraphQL API can lag briefly after a push before it finishes linking a commit's
// author email to the GitHub account that owns it - the commit shows up as unresolved
// (author.user is null) for a short window even though the account link already exists.
// We retry the query a couple of times, then fall back to the REST commit endpoint (which
// resolves this independently) before concluding a commit's author is genuinely unlinked.
const RESOLUTION_RETRIES = 2
const RESOLUTION_RETRY_DELAY_MS = 3000

interface ResolvedUser {
    login: string
    databaseId: number | null
}

interface RawCommitNode {
    oid: string
    author: { email: string, name: string, user: ResolvedUser | null }
    committer: { email: string, name: string, user: ResolvedUser | null }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchCommitNodes(): Promise<RawCommitNode[]> {
    const response: any = await octokit.graphql(`
    query($owner:String! $name:String! $number:Int! $cursor:String!){
        repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
            commits(first: 100, after: $cursor) {
                totalCount
                edges {
                    node {
                        commit {
                            oid
                            author {
                                email
                                name
                                user {
                                    id
                                    databaseId
                                    login
                                }
                            }
                            committer {
                                email
                                name
                                user {
                                    id
                                    databaseId
                                    login
                                }
                            }
                        }
                    }
                    cursor
                }
                pageInfo {
                    endCursor
                    hasNextPage
                }
            }
        }
    }
}`.replace(/ /g, ''), {
        owner: context.repo.owner,
        name: context.repo.repo,
        number: context.issue.number,
        cursor: ''
    })
    return response.repository.pullRequest.commits.edges.map(edge => edge.node.commit)
}

function classifyCommits(commitNodes: RawCommitNode[]): { committers: CommittersDetails[], unlinkedCommits: UnlinkedCommitDetails[] } {
    let committers: CommittersDetails[] = []
    let unlinkedCommits: UnlinkedCommitDetails[] = []
    commitNodes.forEach(commit => {
        const resolvedUser = commit.author.user || commit.committer.user
        if (resolvedUser) {
            addCommitter(committers, resolvedUser)
        } else {
            unlinkedCommits.push({
                sha: commit.oid,
                name: commit.author.name || commit.committer.name,
                email: commit.author.email || commit.committer.email
            })
        }
    })
    return { committers, unlinkedCommits }
}

function addCommitter(committers: CommittersDetails[], resolvedUser: ResolvedUser): void {
    const user = {
        name: resolvedUser.login,
        id: resolvedUser.databaseId || 0,
        pullRequestNo: context.issue.number
    }
    if (committers.map(c => c.name).indexOf(user.name) < 0) {
        committers.push(user)
    }
}

// Cross-checks a single commit against the REST commit endpoint, which resolves the
// author/committer -> GitHub account link independently of the GraphQL API above.
async function resolveViaRest(unlinkedCommit: UnlinkedCommitDetails): Promise<ResolvedUser | null> {
    const result = await octokit.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: unlinkedCommit.sha
    })
    const resolved = result.data.author || result.data.committer
    if (resolved?.login && resolved?.id) {
        return { login: resolved.login, databaseId: resolved.id }
    }
    return null
}

export default async function getCommitters(): Promise<GetCommittersResult> {
    try {
        let { committers, unlinkedCommits } = classifyCommits(await fetchCommitNodes())

        for (let attempt = 1; attempt <= RESOLUTION_RETRIES && unlinkedCommits.length > 0; attempt++) {
            core.info(`${unlinkedCommits.length} commit(s) still unresolved after GraphQL query - this can be a transient indexing lag right after a push, retrying (attempt ${attempt}/${RESOLUTION_RETRIES})`)
            await sleep(RESOLUTION_RETRY_DELAY_MS)
            ;({ committers, unlinkedCommits } = classifyCommits(await fetchCommitNodes()))
        }

        if (unlinkedCommits.length > 0) {
            const stillUnlinked: UnlinkedCommitDetails[] = []
            for (const unlinkedCommit of unlinkedCommits) {
                const resolvedUser = await resolveViaRest(unlinkedCommit)
                if (resolvedUser) {
                    core.info(`Commit ${unlinkedCommit.sha} resolved to ${resolvedUser.login} via REST after GraphQL failed to link it`)
                    addCommitter(committers, resolvedUser)
                } else {
                    stillUnlinked.push(unlinkedCommit)
                }
            }
            unlinkedCommits = stillUnlinked
        }

        const filteredCommitters = committers.filter((committer) => {
            return committer.id !== 41898282
        })
        return { committers: filteredCommitters, unlinkedCommits }

    } catch (e) {
        throw new Error('graphql call to get the committers details failed:' + e)
    }

}
