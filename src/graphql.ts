import { octokit } from './octokit'
import { context } from '@actions/github'
import { CommittersDetails, UnlinkedCommitDetails } from './interfaces'

export interface GetCommittersResult {
    committers: CommittersDetails[]
    unlinkedCommits: UnlinkedCommitDetails[]
}

export default async function getCommitters(): Promise<GetCommittersResult> {
    try {
        let committers: CommittersDetails[] = []
        let unlinkedCommits: UnlinkedCommitDetails[] = []
        let response: any = await octokit.graphql(`
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
        response.repository.pullRequest.commits.edges.forEach(edge => {
            const commit = edge.node.commit
            const resolvedUser = commit.author.user || commit.committer.user
            if (resolvedUser) {
                let user = {
                    name: resolvedUser.login,
                    id: resolvedUser.databaseId || '',
                    pullRequestNo: context.issue.number
                }
                if (committers.length === 0 || committers.map((c) => {
                    return c.name
                }).indexOf(user.name) < 0) {
                    committers.push(user)
                }
            } else {
                unlinkedCommits.push({
                    sha: commit.oid,
                    name: commit.author.name || commit.committer.name,
                    email: commit.author.email || commit.committer.email
                })
            }
        })
        const filteredCommitters = committers.filter((committer) => {
            return committer.id !== 41898282
        })
        return { committers: filteredCommitters, unlinkedCommits }

    } catch (e) {
        throw new Error('graphql call to get the committers details failed:' + e)
    }

}
