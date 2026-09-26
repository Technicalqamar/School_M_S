import mongoose from 'mongoose';

const timetableDesignSchema = new mongoose.Schema({
  logo: {
    show: { type: Boolean, default: true },
    size: { type: Number, default: 40 },
    width: { type: Number, default: 40 },
    height: { type: Number, default: 40 },
    position: { type: String, default: 'left' },
    verticalPosition: { type: String, default: 'center' },
  },
  schoolName: {
    show: { type: Boolean, default: true },
    fontSize: { type: String, default: '14px' },
    fontWeight: { type: String, default: '700' },
    color: { type: String, default: '#ffffff' },
    align: { type: String, default: 'left' },
    verticalPos: { type: String, default: 'center' },
    letterSpacing: { type: Number, default: 0 },
    lineHeight: { type: String, default: '1.2' },
  },
  academicYear: {
    show: { type: Boolean, default: true },
    fontSize: { type: String, default: '10px' },
    fontWeight: { type: String, default: '400' },
    color: { type: String, default: '#ffffff' },
    align: { type: String, default: 'left' },
    verticalPos: { type: String, default: 'center' },
  },
  title: {
    text: { type: String, default: '' },
    fontSize: { type: String, default: '14px' },
    fontWeight: { type: String, default: '400' },
    color: { type: String, default: '#ffffff' },
    align: { type: String, default: 'left' },
    verticalPos: { type: String, default: 'center' },
    letterSpacing: { type: Number, default: 0 },
  },
  headerSpacing: {
    paddingTop: { type: Number, default: 14 },
    paddingBottom: { type: Number, default: 14 },
    paddingLeft: { type: Number, default: 20 },
    paddingRight: { type: Number, default: 20 },
    logoTitleGap: { type: Number, default: 12 },
    nameTitleGap: { type: Number, default: 4 },
  },
  table: {
    borderWidth: { type: String, default: '1' },
    borderRadius: { type: String, default: '0' },
    cellPadding: { type: String, default: 'medium' },
    alternateRowColor: { type: Boolean, default: true },
    gridLines: { type: Boolean, default: true },
  },
  fonts: {
    headerFontSize: { type: String, default: '14px' },
    tableFontSize: { type: String, default: '12px' },
    fontWeight: { type: String, default: '400' },
    fontFamily: { type: String, default: 'Inter' },
  },
  colors: {
    headerBg: { type: String, default: '#1d4ed8' },
    headerText: { type: String, default: '#ffffff' },
    tableHeaderBg: { type: String, default: '#1d4ed8' },
    tableHeaderText: { type: String, default: '#ffffff' },
    periodCell: { type: String, default: '#ffffff' },
    breakCell: { type: String, default: '#f8fafc' },
  },
  page: {
    paperSize: { type: String, default: 'A4' },
    orientation: { type: String, default: 'landscape' },
    marginTop: { type: String, default: '15mm' },
    marginBottom: { type: String, default: '15mm' },
    marginLeft: { type: String, default: '10mm' },
    marginRight: { type: String, default: '10mm' },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
});

const TimetableDesign = mongoose.model('TimetableDesign', timetableDesignSchema);

export default TimetableDesign;
