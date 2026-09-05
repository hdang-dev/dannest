import app from "./app";
import { connect } from "./db/mongoose";
import { env } from "./config/env";

connect()
  .then(() => {
    app.listen(env.port, () => console.log(`dannest-marketplace listening on ${env.port}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
