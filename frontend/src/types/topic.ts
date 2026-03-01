export interface Topic {
  id: string
  name: string
  created_at: string
}

export interface TopicCreatePayload {
  name: string
}

export interface TopicRenamePayload {
  name: string
}
