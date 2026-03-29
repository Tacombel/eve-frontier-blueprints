/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@evefrontier/dapp-kit"],
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.DefinePlugin({
        "import.meta.env": JSON.stringify({
          VITE_OBJECT_ID: "",
          VITE_TENANT: "",
          VITE_EVE_WORLD_PACKAGE_ID: "0xf115375112eab1dcc1bb4af81a37d47ca7e95c2eb990cefa1f12f82d689e9543",
          MODE: "production",
          DEV: false,
          PROD: true,
        }),
      })
    );
    return config;
  },
};

export default nextConfig;
