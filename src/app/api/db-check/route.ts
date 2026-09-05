import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const results: Record<string, string> = {};

  try { await db.submission.count(); results["Submission"] = "OK"; } catch (e: any) { results["Submission"] = e.message.substring(0, 200); }
  try { await db.submissionFile.count(); results["SubmissionFile"] = "OK"; } catch (e: any) { results["SubmissionFile"] = e.message.substring(0, 200); }

  return NextResponse.json(results);
}