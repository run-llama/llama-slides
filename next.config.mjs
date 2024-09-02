/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
        outputFileTracingIncludes: { "/api/*": ["./node_modules/**/*.wasm"], }
    }
};

export default nextConfig;
