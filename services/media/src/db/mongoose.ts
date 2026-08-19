import mongoose from "mongoose";
import { env } from "../config/env";

export async function connect(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB");
}
