import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AccountScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = uri.split('.').pop() ?? 'jpg';
      const path = `${user!.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id);
        await refreshProfile();
      }
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user!.id);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setEditing(false); }
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{(profile?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}><Ionicons name="camera" size={14} color={Colors.background} /></View>
          </TouchableOpacity>
          <Text style={styles.avatarName}>{profile?.full_name ?? 'Set your name'}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile</Text>
            {!editing && (
              <TouchableOpacity onPress={() => { setFullName(profile?.full_name ?? ''); setPhone(profile?.phone ?? ''); setEditing(true); }}>
                <Text style={styles.editBtn}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <InfoRow icon="person-outline" label="Name" value={editing ?
              <TextInput style={styles.inlineInput} value={fullName} onChangeText={setFullName} placeholderTextColor={Colors.textMuted} /> :
              <Text style={styles.infoValue}>{profile?.full_name ?? '—'}</Text>} />
            <View style={styles.divider} />
            <InfoRow icon="call-outline" label="Phone" value={editing ?
              <TextInput style={styles.inlineInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.textMuted} /> :
              <Text style={styles.infoValue}>{profile?.phone ?? '—'}</Text>} />
            <View style={styles.divider} />
            <InfoRow icon="mail-outline" label="Email" value={<Text style={styles.infoValue}>{user?.email}</Text>} />
          </View>

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => Alert.alert('Sign Out', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Sign Out', style: 'destructive', onPress: signOut }])}>
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={Colors.textSecondary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.accent },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 40, fontWeight: '700', color: Colors.background },
  avatarEdit: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.accent, borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  avatarName: { fontSize: 20, fontWeight: '700', color: Colors.text },
  avatarEmail: { fontSize: 14, color: Colors.textSecondary },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  editBtn: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoIcon: { marginRight: 12 },
  infoLabel: { color: Colors.textSecondary, fontSize: 14, width: 80 },
  infoValueWrap: { flex: 1 },
  infoValue: { color: Colors.text, fontSize: 15 },
  inlineInput: { color: Colors.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingBottom: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.text, fontWeight: '600' },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.accent },
  saveBtnText: { color: Colors.background, fontWeight: '700' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  signOutText: { color: Colors.danger, fontSize: 16, fontWeight: '600' },
});
