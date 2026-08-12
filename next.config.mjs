/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // ADR-015 pto. 9: el token viaja en el path, así que la página de contraseña
        // nueva NO debe enviar `Referer` a nadie. La fuga no se evita eligiendo path o
        // query —las dos filtran igual—, se evita no enviando la cabecera. Esta página
        // no carga recursos de terceros, así que la política no cuesta nada.
        source: '/reset-password/:token*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
