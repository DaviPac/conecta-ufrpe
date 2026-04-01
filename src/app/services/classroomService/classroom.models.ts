export interface ClassroomCourse {
  id: string;
  name: string;
  room?: string;
}

export interface ClassroomAssignment {
  title: string;
  description?: string;
  due_date?: string;
  alternateLink?: string;
}

export interface AuthUrlResponse {
  auth_url: string;
}

export interface ClassroomSubmission {
  id: string;
  courseWorkId: string;
  state: string;
  grade?: number;
}

export interface ClassroomAnnouncement {
  id: string;
  text: string;
  creationTime: string;
  alternateLink?: string;
}

export interface ClassroomTopic {
  topicId: string;
  name: string;
}

export interface ClassroomMaterial {
    id: string;
    title: string;
    description: string;
    alternateLink: string;
    creationTime: string;
}