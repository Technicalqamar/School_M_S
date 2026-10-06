import NoticeBoard from '../../components/common/NoticeBoard/NoticeBoard';
import teacherNoticesService from '../../services/teacher/teacherNotices.service';

/**
 * Teacher Panel notice board. Reads the published notices addressed to Teachers
 * (or to Everyone) from the existing Communication → Notices module - scoping is
 * resolved on the server from the authenticated teacher session.
 */
const TeacherNotices = () => (
  <NoticeBoard service={teacherNoticesService} subtitleKey="teacherNoticesSubtitle" />
);

export default TeacherNotices;