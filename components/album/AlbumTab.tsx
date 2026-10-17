import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLayout } from '@/hooks/useLayout';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Album, albumClosed, albumOpen, canDelete, deletePhoto, Photo, SignedUrls, uploadPhotos, UploadResult } from '@/lib/album';
import { confirmAction, showAlert } from '@/lib/alert';
import { haptics } from '@/lib/haptics';
import { savePhoto } from '@/lib/savePhoto';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import PhotoGrid from './PhotoGrid';
import PhotoViewer from './PhotoViewer';

const when = (iso: string) => format(new Date(iso), 'EEE d MMM, h:mm a');

/** The event's Photos tab: what you can do, Add photos with progress, the grid and the viewer. */
export default function AlbumTab({ eventId, album, urls, reload }: {
  eventId: string;
  album: Album | null;
  urls: SignedUrls;
  reload: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const { isWide } = useLayout();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<UploadResult['failed']>([]);
  const [viewing, setViewing] = useState<number | null>(null);

  if (!album || !user) return <ActivityIndicator style={{ marginTop: Space.xxl }} color={theme.colors.primary} />;

  const left = Math.max(0, Math.min(album.per_person - album.my_count, album.per_event - album.photos.length));
  const count = album.photos.length;

  const upload = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setFailed([]);
    setProgress({ done: 0, total: assets.length });
    const result = await uploadPhotos(eventId, user.id, assets, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setFailed(result.failed);
    if (result.added) haptics.success();
    reload();
  };

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: left, orderedSelection: true, quality: 1,
    });
    if (!result.canceled) upload(result.assets.slice(0, left));
  };

  const status = album.can_add
    ? left > 0 ? `You can add ${left} more` : "You've added all the photos you can"
    : !albumOpen(album) ? `Opens ${when(album.opens_at)}`
    : albumClosed(album) ? `Closed ${when(album.closes_at)}. You can still view and save photos`
    : 'Only people going can add photos';

  return (
    <View style={{ gap: Space.lg }}>
      <Card style={{ gap: Space.md }}>
        <View style={{ gap: 4 }}>
          <Text style={theme.type.heading}>{count === 1 ? '1 photo' : `${count} photos`}</Text>
          <Text style={theme.type.caption}>{status}</Text>
        </View>

        {album.can_add && left > 0 && !progress && <Button title="Add photos" icon="images-outline" onPress={pick} />}

        {progress && (
          <View style={{ gap: Space.sm }}>
            <Text style={theme.type.bodySecondary}>Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(progress.done / progress.total) * 100}%` }]} />
            </View>
          </View>
        )}

        {failed.length > 0 && (
          <View style={{ gap: Space.sm }}>
            <Text style={[theme.type.caption, { color: theme.colors.dangerText }]}>
              {failed.length === 1 ? "1 photo didn't upload" : `${failed.length} photos didn't upload`}: {failed[0].message}
            </Text>
            {album.can_add && left > 0 && (
              <Button title="Try again" variant="outline" size="sm" onPress={() => upload(failed.map((f) => f.asset).slice(0, left))} style={{ alignSelf: 'flex-start' }} />
            )}
          </View>
        )}
      </Card>

      {count === 0 ? (
        <EmptyState
          icon="images-outline"
          title={albumClosed(album) ? 'No photos were added' : albumOpen(album) ? 'No photos yet' : 'The album opens when the party starts'}
          body={
            albumClosed(album) ? 'The album is closed now.'
            : album.can_add ? 'Add the first ones from the party.'
            : albumOpen(album) ? 'Photos people add will show up here.'
            : 'Everyone going can add their photos.'
          }
        />
      ) : (
        <PhotoGrid photos={album.photos} urls={urls} columns={isWide ? 5 : 3} onOpen={setViewing} />
      )}

      <PhotoViewer
        photos={album.photos}
        urls={urls}
        startIndex={viewing}
        onClose={() => setViewing(null)}
        canDelete={(p: Photo) => canDelete(album, p, user.id)}
        onDelete={async (p) => {
          if (!(await confirmAction('Delete this photo?', "It'll be removed for everyone.", 'Delete', true))) return;
          try { await deletePhoto(p.id); reload(); } catch (e) { showAlert('Could not delete', (e as Error).message); }
        }}
        onSave={async (p) => {
          try {
            await savePhoto(urls[p.path], `wya-${p.id.slice(0, 8)}.jpg`);
            if (Platform.OS !== 'web') { haptics.success(); showAlert('Saved', 'The photo is in your library.'); }
          } catch (e) { showAlert('Could not save', (e as Error).message); }
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill, backgroundColor: t.colors.primary },
}));
