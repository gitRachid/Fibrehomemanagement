import { Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { useAssignments } from '@/hooks';

export default function AssignmentsScreen() {
  const { data: assignments = [], isLoading } = useAssignments();

  return (
    <Screen title="Assignments" loading={isLoading}>
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
