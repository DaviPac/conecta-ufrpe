import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClassroomAnnouncement, ClassroomAssignment, ClassroomCourse, ClassroomSubmission, ClassroomTopic } from './classroom.models';

@Injectable({
  providedIn: 'root'
})
export class ClassroomService {
  private apiUrl = 'https://sigaa-ufrpe-api-production.up.railway.app/classroom'; 

  constructor(private http: HttpClient) { }

  getGoogleAuthUrl(matricula: string): Observable<{ auth_url: string }> {
    // Passamos a matrícula via query string, como definido no Go
    return this.http.get<{ auth_url: string }>(`${this.apiUrl}/auth-url?matricula=${matricula}`);
  }

  /**
   * Busca as turmas ativas do aluno no Google Classroom
   * Escopo: https://www.googleapis.com/auth/classroom.courses.readonly
   */
  getCourses(matricula: string): Observable<ClassroomCourse[]> {
    const body = { matricula };
    return this.http.post<ClassroomCourse[]>(`${this.apiUrl}/courses`, body);
  }

  /**
   * Busca as atividades (CourseWork) de uma turma específica
   * Escopo: https://www.googleapis.com/auth/classroom.course-work.readonly
   */
  getAssignments(matricula: string, courseId: string): Observable<ClassroomAssignment[]> {
    const body = { 
      matricula: matricula, 
      course_id: courseId 
    };
    return this.http.post<ClassroomAssignment[]>(`${this.apiUrl}/assignments`, body);
  }

  /**
   * Busca as notas e entregas (Student Submissions) do aluno em uma atividade
   * Escopo: https://www.googleapis.com/auth/classroom.student-submissions.me.readonly
   */
  getSubmissions(matricula: string, courseId: string, courseWorkId: string): Observable<ClassroomSubmission[]> {
    const body = { 
      matricula: matricula, 
      course_id: courseId,
      course_work_id: courseWorkId 
    };
    return this.http.post<ClassroomSubmission[]>(`${this.apiUrl}/submissions`, body);
  }

  /**
   * Busca os anúncios/postagens do mural de uma turma específica
   * Escopo: https://www.googleapis.com/auth/classroom.announcements.readonly
   */
  getAnnouncements(matricula: string, courseId: string): Observable<ClassroomAnnouncement[]> {
    const body = { 
      matricula: matricula, 
      course_id: courseId 
    };
    return this.http.post<ClassroomAnnouncement[]>(`${this.apiUrl}/announcements`, body);
  }

  /**
   * Busca os tópicos (categorias de atividades) de uma turma
   * Escopo: https://www.googleapis.com/auth/classroom.topics.readonly
   */
  getTopics(matricula: string, courseId: string): Observable<ClassroomTopic[]> {
    const body = { 
      matricula: matricula, 
      course_id: courseId 
    };
    return this.http.post<ClassroomTopic[]>(`${this.apiUrl}/topics`, body);
  }
}