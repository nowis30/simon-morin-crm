declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PwaOptions = {
    dest: string;
    disable?: boolean;
  };

  const withPWAInit: (options: PwaOptions) => (config: NextConfig) => NextConfig;
  export default withPWAInit;
}
