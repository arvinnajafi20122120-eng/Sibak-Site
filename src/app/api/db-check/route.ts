import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRgConfig, evaluateGlobalUsage, measureDatabase, measurePerUserUsage, measureUploadsDir, maybePruneRgEvents } from "@/lib/resource-guard";
import { backupsSummary } from "@/lib/rg-backup";

export async function GET() {
  const results: Record<string, string> = {};

  try { await getRgConfig(); results["getRgConfig"] = "OK"; } catch (e: any) { results["getRgConfig"] = e.message; }
  try { await evaluateGlobalUsage(); results["evaluateGlobalUsage"] = "OK"; } catch (e: any) { results["evaluateGlobalUsage"] = e.message; }
  try { await measureUploadsDir(); results["measureUploadsDir"] = "OK"; } catch (e: any) { results["measureUploadsDir"] = e.message; }
  try { await measureDatabase(); results["measureDatabase"] = "OK"; } catch (e: any) { results["measureDatabase"] = e.message; }
  try { const cfg = await getRgConfig(); await measurePerUserUsage(cfg); results["measurePerUserUsage"] = "OK"; } catch (e: any) { results["measurePerUserUsage"] = e.message; }
  try { await backupsSummary(); results["backupsSummary"] = "OK"; } catch (e: any) { results["backupsSummary"] = e.message; }

  return NextResponse.json(results);
}