import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  model: {
    type: String,
    required: [true, 'Model name is required'],
    unique: true,
    trim: true,
  },
  sequenceValue: {
    type: Number,
    default: 0,
  },
});

counterSchema.statics.increment = async function (modelName) {
  const result = await this.findOneAndUpdate(
    { model: modelName },
    { $inc: { sequenceValue: 1 } },
    { returnDocument: "after", upsert: true },
  );
  return result.sequenceValue;
};

counterSchema.statics.incrementBy = async function (modelName, steps = 1) {
  const increment = Math.max(1, Number(steps) || 1);
  const result = await this.findOneAndUpdate(
    { model: modelName },
    { $inc: { sequenceValue: increment } },
    { returnDocument: "after", upsert: true },
  );
  return result.sequenceValue;
};

counterSchema.statics.getCurrentValue = async function (modelName) {
  const counter = await this.findOne({ model: modelName });
  return counter ? counter.sequenceValue : 0;
};

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
