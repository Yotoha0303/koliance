"use client";

import React, { useState } from "react";
import { AgentCardTerminal } from "@/components/AgentCardTerminal";
import { TrustRecordData } from "@/lib/contract";

interface TrustConstellationProps {
  currentAccount: `0x${string}` | null;
  records?: TrustRecordData[];
}

export function TrustConstellation({ currentAccount, records }: TrustConstellationProps) {
  return (
    <div className="w-full">
      <AgentCardTerminal currentAccount={currentAccount} records={records} />
    </div>
  );
}
