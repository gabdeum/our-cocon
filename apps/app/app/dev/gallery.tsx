import { router } from 'expo-router';
import { DevOnly } from '../../components/DevOnly';
import { Gallery } from '../../components/dev/Gallery';

export default function GalleryScreen() {
  return (
    <DevOnly>
      <Gallery onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} onOpenSheetRoute={() => router.push('/dev/sheet')} onOpenModalRoute={() => router.push('/dev/modal')} />
    </DevOnly>
  );
}
