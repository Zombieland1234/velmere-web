export async function writeJsonToStdoutFully(value) {
  const payload = JSON.stringify(value);
  await new Promise((resolve, reject) => {
    process.stdout.write(payload, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return { bytesWritten: Buffer.byteLength(payload) };
}
