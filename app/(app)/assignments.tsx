import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { AppTextInput } from '@/components/app-text-input';
import { useAssignments, useBuildings, useCreateAssignment, useTechnicians } from '@/hooks';
import { useOfflineStore } from '@/store/offline-store';
import { dataService } from '@/services/dataService';

export default function AssignmentsScreen() {
  const { data: assignments = [], isLoading, refetch } = useAssignments();
  const { data: buildings = [] } = useBuildings(undefined, { status: 'active' });
  const { data: technicians = [] } = useTechnicians({ status: 'active' });
  const createAssignment = useCreateAssignment();
  const { isOnline, refreshPendingCount } = useOfflineStore();

  const [buildingId, setBuildingId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const buildingOptions = useMemo(() => buildings.slice(0, 5), [buildings]);
  const technicianOptions = useMemo(() => technicians.slice(0, 5), [technicians]);

  const submit = async () => {
    if (!buildingId || !technicianId) {
      setFormError('Building and technician are required.');
      return;
    }
    setFormError('');
    const payload = {
      itemId: buildingId,
      technicianIds: [technicianId],
      assignedBy: 'mobile-app',
      assignedAt: new Date(),
      status: 'active' as const,
      notes: notes.trim(),
    };
    if (isOnline) {
      await createAssignment.mutateAsync(payload);
      setBuildingId('');
      setTechnicianId('');
      setNotes('');
      await refetch();
    } else {
      await dataService.createAssignment(payload);
      refreshPendingCount();
      setBuildingId('');
      setTechnicianId('');
      setNotes('');
    }
  };

  return (
    <Screen title="Assignments" subtitle="Assign buildings to active technicians" loading={isLoading}>
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, gap: 10 }}>
        <AppTextInput
          label="Building id"
          value={buildingId}
          onChangeText={setBuildingId}
          placeholder="Select below or type idImmeuble"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {buildingOptions.map((building: any) => (
            <Pressable key={building._id || building.idImmeuble} onPress={() => setBuildingId(building.idImmeuble)}>
              <Text style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }}>
                {building.idImmeuble}
              </Text>
            </Pressable>
          ))}
        </View>

        <AppTextInput label="Technician id" value={technicianId} onChangeText={setTechnicianId} placeholder="Select below or type id" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {technicianOptions.map((tech: any) => (
            <Pressable key={tech._id || tech.id} onPress={() => setTechnicianId(tech.id)}>
              <Text style={{ backgroundColor: '#ecfeff', color: '#0e7490', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }}>
                {tech.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <AppTextInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional intervention notes" />
        {formError ? <Text style={{ color: '#dc2626', fontSize: 12 }}>{formError}</Text> : null}
        <Pressable onPress={submit} style={{ borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', paddingVertical: 12 }}>
          {createAssignment.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Create Assignment</Text>}
        </Pressable>
      </View>

      {assignments.map((assignment: any) => (
        <View key={assignment._id} style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, gap: 5 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>Building: {assignment.itemId?.idImmeuble || assignment.itemId}</Text>
          <Text style={{ fontSize: 13, color: '#334155' }}>Status: {assignment.status}</Text>
          <Text style={{ fontSize: 13, color: '#64748b' }}>Assigned by: {assignment.assignedBy}</Text>
        </View>
      ))}
    </Screen>
  );
}
