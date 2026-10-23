import HomeworkDiaryTab from './HomeworkDiaryTab';

// WhatsApp Assignments tab. The Homework Diary feature uploads the selected
// image to this backend for a short time, then sends the image URL + caption to
// eligible guardians through the existing WhatsApp client.
const WhatsAppAssignments = () => (
  <div className="space-y-6">
    <HomeworkDiaryTab />
  </div>
);

export default WhatsAppAssignments;
