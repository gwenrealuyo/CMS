"use client";

import { Toaster } from "react-hot-toast";

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      containerStyle={{ zIndex: 99999 }}
    />
  );
}
