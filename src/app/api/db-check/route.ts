import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { buildStorageName, checkUploadQuota } from "@/lib/resource-guard";

export async function GET() {
  const results: Record<string, string> = {};

  // 1. Check quota
  try {
    await checkUploadQuota({ userId: "test", fileSize: 1024, kind: "FILE" });
    results["1_quota"] = "OK";
  } catch (e: any) {
    results["1_quota"] = e.message;
  }

  // 2. Build storage name
  let pathname = "";
  try {
    pathname = `blob/${buildStorageName("test.txt")}`;
    results["2_storageName"] = "OK: " + pathname;
  } catch (e: any) {
    results["2_storageName"] = e.message;
  }

  // 3. Create RgFile record
  let rgFileId = "";
  try {
    const rgFile = await db.rgFile.create({
      data: {
        ownerId: "test",
        pathname,
        fileName: "test.txt",
        mimeType: "text/plain",
        size: 5,
        storage: "BLOB",
      },
      select: { id: true },
    });
    rgFileId = rgFile.id;
    results["3_rgFileCreate"] = "OK: " + rgFileId;
  } catch (e: any) {
    results["3_rgFileCreate"] = e.message;
  }

  // 4. Upload to Vercel Blob
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      results["4_blobUpload"] = "NO_TOKEN";
    } else {
      await put(pathname, Buffer.from("hello"), {
        access: "private",
        addRandomSuffix: false,
        contentType: "text/plain",
        token,
      });
      results["4_blobUpload"] = "OK";
    }
  } catch (e: any) {
    results["4_blobUpload"] = e.message;
  }

  // 5. Cleanup test RgFile
  try {
    if (rgFileId) await db.rgFile.delete({ where: { id: rgFileId } });
    results["5_cleanup"] = "OK";
  } catch (e: any) {
    results["5_cleanup"] = e.message;
  }

  return NextResponse.json(results);
}