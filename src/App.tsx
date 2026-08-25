import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from './store'
import { FacultyLayout } from './components/layout/FacultyLayout'

// Public student pages
import Landing from './pages/Landing'
import StaffLogin from './pages/StaffLogin'
import AttendanceHistory from './pages/student/AttendanceHistory'
import CourseAttendanceDetail from './pages/student/CourseAttendanceDetail'

// Faculty
import FacultyCourses from './pages/faculty/FacultyCourses'
import CourseDetail from './pages/faculty/CourseDetail'
import LiveSession from './pages/faculty/LiveSession'
import PostSessionReview from './pages/faculty/PostSessionReview'
import FacultyDashboard from './pages/faculty/FacultyDashboard'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCourses from './pages/admin/AdminCourses'

function FacultyProtected({ children }: { children: React.ReactNode }) {
  const { role } = useAppStore()
  if (!role || role !== 'faculty') return <Navigate to="/staff" replace />
  return <FacultyLayout>{children}</FacultyLayout>
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { role } = useAppStore()
  if (!role || role !== 'admin') return <Navigate to="/staff" replace />
  return <FacultyLayout>{children}</FacultyLayout>
}

export default function App() {
  const { role } = useAppStore()

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — no auth required */}
        <Route path="/" element={<Landing />} />
        <Route path="/history" element={<AttendanceHistory />} />
        <Route path="/history/course" element={<CourseAttendanceDetail />} />
        <Route
          path="/staff"
          element={role && role !== 'student'
            ? <Navigate to={role === 'faculty' ? '/faculty/courses' : '/admin/dashboard'} replace />
            : <StaffLogin />
          }
        />

        {/* Faculty — no sidebar */}
        <Route path="/faculty/courses" element={<FacultyProtected><FacultyCourses /></FacultyProtected>} />
        <Route path="/faculty/courses/:courseId" element={<FacultyProtected><CourseDetail /></FacultyProtected>} />
        <Route path="/faculty/sessions/:sessionId/live" element={<FacultyProtected><LiveSession /></FacultyProtected>} />
        <Route path="/faculty/sessions/:sessionId/review" element={<FacultyProtected><PostSessionReview /></FacultyProtected>} />
        {/* <Route path="/faculty/dashboard" element={<Navigate to="/faculty/courses" replace />} /> */}
        <Route path="/faculty/dashboard" element={<FacultyProtected><FacultyDashboard /></FacultyProtected>} />


        {/* Admin */}
        <Route path="/admin/dashboard" element={<AdminProtected><AdminDashboard /></AdminProtected>} />
        <Route path="/admin/courses" element={<AdminProtected><AdminCourses /></AdminProtected>} />
        <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            fontSize: '13px',
            boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
          },
          success: { iconTheme: { primary: '#16A34A', secondary: '#FFFFFF' } },
          error: { iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' } },
        }}
      />
    </BrowserRouter>
  )
}
