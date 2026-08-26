export interface CommitterMap {
    signed: CommittersDetails[],
    notSigned: CommittersDetails[]
}

export interface UnlinkedCommitDetails {
    sha: string,
    name: string,
    email: string
}

export interface ReactedCommitterMap {
    newSigned: CommittersDetails[],
    onlyCommitters?: CommittersDetails[],
    allSignedFlag: boolean
}

export interface CommentedCommitterMap {
    newSigned: CommittersDetails[],
    onlyCommitters?: CommittersDetails[],
    allSignedFlag: boolean
}

export interface CommittersDetails {
    name: string,
    id: number,
    pullRequestNo?: number,
    created_at?: string,
    updated_at?: string
    comment_id?: number,
    body?: string,
    repoId?: string
}

export interface LabelName {
    current_name: string,
    name: string
}

export interface CommittersCommentDetails {
    name: string,
    id: number,
    comment_id: number,
    body: string,
    created_at: string,
    updated_at: string
}

export interface ClafileContentAndSha {
    claFileContent: any,
    sha: string
}