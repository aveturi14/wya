import PlanCard from '@/components/chat/PlanCard';
import PollCard from '@/components/chat/PollCard';
import ReceiptCard from '@/components/chat/ReceiptCard';
import CollectCard from '@/components/collect/CollectCard';
import SplitCard from '@/components/chat/SplitCard';
import { Avatar } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { IconSquare } from '@/components/ui/ListRow';
import Logo from '@/components/ui/Logo';
import PressableScale from '@/components/ui/PressableScale';
import { eventTheme } from '@/constants/eventThemes';
import { Fonts, Radius, Space } from '@/constants/theme';
import { makeStyles, useTheme } from '@/hooks/useTheme';
import { Command, CommandName } from '@/lib/commands';
import { supabase } from '@/lib/supabase';
import { ChatMessage, ChatMessageKind } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';
import { Image } from 'expo-image';
import { ReactElement, RefObject, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

// Chat images live in the public event-images bucket; rows keep only the path
export const chatImageUrl = (path: string) => supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;

// Kinds this version of the app can draw; anything newer gets a polite placeholder
const DRAWN_KINDS: ChatMessageKind[] = ['text', 'image', 'poll', 'split', 'plan', 'bot', 'system', 'receipt', 'collect'];

const COMMAND_ICONS: Record<CommandName, keyof typeof Ionicons.glyphMap> = {
  poll: 'stats-chart-outline',
  split: 'cash-outline',
  bill: 'receipt-outline',
  plan: 'list-outline',
  here: 'hand-right-outline',
  remind: 'megaphone-outline',
  help: 'help-circle-outline',
};

/**
 * The event chat: messages under a header (the slim event header on phones), your
 * bubbles in the event's colour, cards for polls, plans and splits, and a composer
 * whose "/" opens the list of things you can type. Drawing only: sending, commands
 * and Realtime stay in the event page.
 */
export default function EventChat({
  eventId, eventTheme: themeName, header, canChat, messages, myId, isHost, nameOf, listRef,
  pollVersions, focusTick, planTick, receiptTick,
  draft, onDraftChange, onSend, sending, onPickImage, sendingImage, suggestions, onUseCommand,
}: {
  eventId: string;
  eventTheme: string;
  header: ReactElement | null;
  canChat: boolean;
  messages: ChatMessage[];
  myId?: string;
  isHost: boolean;
  nameOf: (userId: string | null) => string | null;
  listRef: RefObject<FlatList | null>;
  pollVersions: Record<string, number>;
  focusTick: number;
  planTick: number;
  receiptTick: number;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onPickImage: () => void;
  sendingImage: boolean;
  suggestions: Command[];
  onUseCommand: (name: CommandName) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const t = eventTheme(themeName);
  const [viewer, setViewer] = useState<number | null>(null);

  // On phones the chat scrolls under the header; scrolling mid-layout is unreliable, so wait a frame
  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  // Every image in the chat, oldest first, so the viewer can swipe through them all
  const images = messages.flatMap((m) => (m.image_path ? [chatImageUrl(m.image_path)] : []));
  const openImage = (path: string) => setViewer(images.indexOf(chatImageUrl(path)));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {canChat ? (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          // After a new message or the keyboard resizing the list, show the latest messages
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          extraData={[pollVersions, focusTick, planTick, receiptTick]}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const dayBreak = !prev || !isSameDay(new Date(prev.created_at), new Date(item.created_at));
            const body = item.kind === 'poll'
              ? <PollCard message={item} myId={myId} isHost={isHost} nameOf={nameOf} version={pollVersions[item.id] ?? 0} accent={t.a} />
              : item.kind === 'split'
                ? <SplitCard message={item} myId={myId} version={focusTick} />
                : item.kind === 'plan'
                  ? <PlanCard message={item} eventId={eventId} myId={myId} isHost={isHost} version={planTick + focusTick} />
                  : item.kind === 'receipt'
                    ? <ReceiptCard message={item} myId={myId} version={receiptTick + focusTick} />
                    : item.kind === 'collect' && item.data?.collection_id
                      ? <View style={styles.cardRow}><CollectCard key={item.data.status} collectionId={item.data.collection_id} version={focusTick} /></View>
                      : <ChatBubble message={item} isMe={item.user_id === myId} showName={prev?.user_id !== item.user_id || dayBreak} accent={{ bg: t.a, fg: t.ink }} onImagePress={openImage} />;
            return (
              <View>
                {dayBreak && <Text style={styles.day}>{format(new Date(item.created_at), 'EEEE d MMM')}</Text>}
                {body}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[theme.type.bodySecondary, styles.empty]}>No messages yet. Say hi 👋</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Space.xxxl }}>
          {header}
          <EmptyState icon="lock-closed-outline" title="Chat is for people who are coming" body={'Say "I\'m in" or "Maybe" to join the conversation.'} />
        </ScrollView>
      )}

      {suggestions.length > 0 && (
        <View style={styles.slash}>
          <Text style={[theme.type.label, styles.slashLabel]}>Things you can type</Text>
          {suggestions.map((cmd) => (
            <PressableScale key={cmd.name} onPress={() => onUseCommand(cmd.name)} scaleTo={0.99} style={styles.cmdRow} hoverStyle={styles.cmdHover} accessibilityLabel={`Use /${cmd.name}`}>
              <IconSquare icon={COMMAND_ICONS[cmd.name]} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cmdName}>/{cmd.name}{cmd.hostOnly ? <Text style={theme.type.caption}>  · host</Text> : null}</Text>
                <Text style={theme.type.caption} numberOfLines={1}>{cmd.description}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      )}

      {canChat && (
        <View style={styles.compose}>
          <PressableScale onPress={onPickImage} disabled={sendingImage} style={styles.attach} accessibilityLabel="Send image">
            {sendingImage
              ? <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              : <Ionicons name="image-outline" size={21} color={theme.colors.textSecondary} />}
          </PressableScale>
          <TextInput
            style={[styles.input, draft.startsWith('/') && { fontFamily: Fonts.monoRegular }]}
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Message, or / for commands"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            // React Native Web starts a multiline input two rows tall; start at one and let it grow
            numberOfLines={Platform.OS === 'web' ? 1 : undefined}
            accessibilityLabel="Message"
          />
          <PressableScale onPress={onSend} disabled={!draft.trim() || sending} style={[styles.send, { backgroundColor: t.a }]} accessibilityLabel="Send message">
            <Ionicons name="arrow-up" size={20} color={t.ink} />
          </PressableScale>
        </View>
      )}
      <ImageLightbox images={images} startIndex={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ message, isMe, showName, accent, onImagePress }: {
  message: ChatMessage;
  isMe: boolean;
  showName: boolean;
  accent: { bg: string; fg: string };
  onImagePress: (path: string) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const c = theme.colors;
  const onAccent = isMe && !message.image_path;
  const timeLabel = (
    <Text style={[styles.time, onAccent && { color: accent.fg, opacity: 0.7 }]}>{format(new Date(message.created_at), 'h:mm a')}</Text>
  );
  if (message.kind === 'bot' || message.kind === 'system') {
    const askedBy: string | undefined = message.data?.asked_by_name;
    return (
      <View style={styles.row}>
        <View style={styles.botMark}><Logo size={11} /></View>
        <View style={[styles.bubble, styles.them]}>
          <Text style={styles.name}>
            wya{askedBy ? <Text style={{ fontFamily: Fonts.body, color: c.textSecondary }}>{` · asked by ${askedBy.split(' ')[0]}`}</Text> : null}
          </Text>
          <Text style={theme.type.body}>{message.content}</Text>
          {timeLabel}
        </View>
      </View>
    );
  }
  if (!DRAWN_KINDS.includes(message.kind)) {
    return (
      <View style={[styles.row, isMe && styles.mine]}>
        <View style={[styles.bubble, styles.them]}>
          <Text style={theme.type.bodySecondary}>Update wya to see this message</Text>
          {timeLabel}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.row, isMe && styles.mine]}>
      {!isMe && (showName
        ? <Avatar name={message.profile?.full_name ?? null} url={message.profile?.avatar_url} seed={message.user_id ?? message.id} size={28} />
        : <View style={{ width: 28 }} />)}
      <View style={{ maxWidth: '78%', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        {!isMe && showName && <Text style={[styles.name, { marginLeft: 4 }]}>{message.profile?.full_name?.split(' ')[0] ?? 'Unknown'}</Text>}
        {message.image_path ? (
          <View style={{ gap: 4 }}>
            <PressableScale onPress={() => onImagePress(message.image_path!)} accessibilityLabel="View image">
              <Image source={{ uri: chatImageUrl(message.image_path) }} style={styles.image} contentFit="cover" recyclingKey={message.id} transition={150} />
            </PressableScale>
            {timeLabel}
          </View>
        ) : (
          <View style={[styles.bubble, isMe ? [styles.me, { backgroundColor: accent.bg }] : styles.them]}>
            <Text style={[theme.type.body, isMe && { color: accent.fg }]}>{message.content}</Text>
            {timeLabel}
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  list: { paddingBottom: Space.lg, gap: 6 },
  empty: { textAlign: 'center', padding: Space.xl },
  day: { ...t.type.micro, textAlign: 'center', marginVertical: Space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, paddingHorizontal: Space.lg },
  mine: { justifyContent: 'flex-end' },
  // Collect cards (stage 1.1): same side padding as bubbles
  cardRow: { paddingHorizontal: Space.lg, maxWidth: 460 },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, gap: 1 },
  me: { borderBottomRightRadius: 6 },
  them: { backgroundColor: t.colors.surfaceAlt, borderBottomLeftRadius: 6 },
  name: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: t.colors.textSecondary },
  time: { ...t.type.micro, alignSelf: 'flex-end', color: t.colors.textMuted },
  image: { width: 210, height: 210, borderRadius: Radius.md },
  botMark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt },
  slash: {
    marginHorizontal: Space.md, marginBottom: Space.sm, borderRadius: Radius.lg, backgroundColor: t.colors.surface, overflow: 'hidden',
    boxShadow: t.isDark ? '0px 0px 0px 1px rgba(255,255,255,0.06), 0px 18px 40px -16px rgba(0,0,0,0.6)' : '0px 0px 0px 1px rgba(0,0,0,0.05), 0px 18px 40px -16px rgba(0,0,0,0.3)',
  },
  slashLabel: { paddingHorizontal: Space.md + 2, paddingTop: Space.md, paddingBottom: 4 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.md + 2, paddingVertical: Space.sm },
  cmdHover: { backgroundColor: t.colors.surfaceAlt },
  cmdName: { fontFamily: Fonts.mono, fontSize: 14, color: t.colors.text },
  compose: { flexDirection: 'row', alignItems: 'flex-end', gap: Space.sm, paddingHorizontal: Space.md, paddingTop: Space.sm, paddingBottom: Space.lg },
  attach: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.surfaceAlt },
  input: {
    ...t.type.input, flex: 1, maxHeight: 120, minHeight: 44, backgroundColor: t.colors.surface, borderRadius: 22,
    paddingHorizontal: Space.lg, paddingTop: 11, paddingBottom: 11, borderWidth: 1, borderColor: t.isDark ? t.colors.outline : t.colors.border,
    outlineStyle: 'none',
  } as any,
  send: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
}));
