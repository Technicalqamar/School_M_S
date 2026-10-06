import NoticeBoard from '../../components/common/NoticeBoard/NoticeBoard';
import studentNoticesService from '../../services/student/studentNotices.service';

/**
 * Student Portal notice board. Reads the published notices addressed to
 * Students (or to Everyone) from the existing Communication → Notices module -
 * scoping is resolved on the server from the authenticated student session.
 */
const StudentNotices = () => (
  <NoticeBoard service={studentNoticesService} subtitleKey="portalNoticesSubtitle" />
);

export default StudentNotices;