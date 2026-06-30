export default function handler(req, res) {
  res.status(200).json({ token: process.env.BLOB_READ_WRITE_TOKEN || "Token not found" });
}