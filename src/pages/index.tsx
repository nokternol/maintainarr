import type { GetServerSideProps } from 'next';

// DEV: Auth bypassed — redirect straight to the providers playground.
// Remove getServerSideProps and restore auth logic when login is re-enabled.
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: { destination: '/providers', permanent: false },
  };
};

export default function Home() {
  return null;
}
