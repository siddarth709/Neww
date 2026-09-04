import React from "react";
const VARIANTS={verified:{dot:"verified",label:"Verified"},flagged:{dot:"flagged",label:"Flagged"},pending:{dot:"pending",label:"Pending"}};
export default function StatusPill({status,children}) { const v=VARIANTS[status]||VARIANTS.pending; return <span className={`status-pill ${v.dot}`}><i />{children||v.label}</span>; }
