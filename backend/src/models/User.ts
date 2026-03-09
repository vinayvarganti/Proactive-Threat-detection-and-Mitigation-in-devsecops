import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  githubId: string;
  username: string;
  email: string;
  avatarUrl: string;
  encryptedToken: string;
  tokenExpiresAt: Date;
  refreshToken: string;
  createdAt: Date;
  lastLoginAt: Date;
}

const UserSchema: Schema = new Schema({
  githubId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    required: true
  },
  encryptedToken: {
    type: String,
    required: true
  },
  tokenExpiresAt: {
    type: Date,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IUser>('User', UserSchema);
