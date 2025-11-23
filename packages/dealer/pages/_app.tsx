import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }: AppProps) {
  const ToasterComponent = Toaster as any;
  return (
    <>
      <ToasterComponent position="top-center" />
      <Component {...pageProps} />
    </>
  );
}
