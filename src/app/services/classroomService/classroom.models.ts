export interface ClassroomCourse {
  id: string;
  name: string;
  room?: string;
}

export interface ClassroomAssignment {
  title: string;
  description?: string;
  due_date?: string;
}

export interface AuthUrlResponse {
  auth_url: string;
}

export interface ClassroomSubmission {
  id: string;
  state: string;
  assignedGrade?: number;
  alternateLink?: string;
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