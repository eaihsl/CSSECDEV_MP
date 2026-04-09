const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true},
  password: { type: String, required: true },
  role: { type: String, enum: ['people', 'business', 'admin'], default: 'people' },
  profilePicture: { type: String },
  shortDescription: { type: String },
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // 2.1.8 - Account lockout fields
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  // 2.1.9 - Security question fields
  securityQuestion: { type: String, default: null },
  securityAnswer: { type: String, default: null },
  // 2.1.10 - Password history (store last 5 hashes to prevent re-use)
  passwordHistory: { type: [String], default: [] },
  // 2.1.11 - Track when password was last changed
  passwordChangedAt: { type: Date, default: null },
  // 2.1.12 - Track last login info
  lastLoginAt: { type: Date, default: null },
  lastLoginAttemptAt: { type: Date, default: null },
  lastLoginSuccess: { type: Boolean, default: null },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);