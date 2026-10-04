// app/(app)/my-group.jsx
//
// My Group — the group the signed-in user belongs to (operator member or
// supervisor). Read-only: management stays on the Groups screen (ADMIN).
// Resolution: supervised group first, else first membership, else empty state.

import { useEffect, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import Avatar from "../../src/components/Avatar";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useAuth } from "../../src/hooks/useAuth";
import {
  fetchGroups,
  fetchGroupOperators,
  fetchGroupSupervisor,
  clearGroupCurrent,
} from "../../src/store/slices/groupSlice";

export default function MyGroupScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dark = useDark();
  const isDesktop = useBreakpoint() === "desktop";
  const { user } = useAuth();
  const { list, status, operators, supervisor, membersStatus } = useAppSelector((s) => s.group);

  useEffect(() => {
    dispatch(fetchGroups({ page: 0, size: 100 }));
    return () => {
      dispatch(clearGroupCurrent());
    };
  }, [dispatch]);

  const myGroup = useMemo(() => {
    if (!user || !list.length) return null;
    const supervised = list.find((g) => g.supervisorId && g.supervisorId === user.id);
    if (supervised) return supervised;
    return list.find((g) => (g.operators || []).includes(user.id)) || null;
  }, [list, user]);

  useEffect(() => {
    if (myGroup?.id) {
      dispatch(fetchGroupOperators(myGroup.id));
      dispatch(fetchGroupSupervisor(myGroup.id));
    }
  }, [dispatch, myGroup?.id]);

  const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "—";
  const loading = status === "loading";
  const titleClass = `text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`;

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={isDesktop ? `${titleClass} mb-5` : `text-xl font-bold font-inter mb-4 ${dark ? "text-white" : "text-text"}`}>
          My Group
        </Text>

        {loading && (
          <Card>
            <Skeleton width="40%" height={20} className="mb-3" />
            <Skeleton width="100%" height={48} className="mb-2" />
            <Skeleton width="100%" height={48} />
          </Card>
        )}

        {!loading && !myGroup && (
          <Card>
            <EmptyState
              title="No group assigned"
              message="You are not a member of any group yet. Ask your administrator to assign you to one."
            />
          </Card>
        )}

        {!loading && myGroup && (
          <>
            <View className="flex-row items-start justify-between mb-4 gap-3">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-text font-inter">{myGroup.name}</Text>
                <Text className="text-sm text-text-muted font-inter mt-0.5">
                  {(myGroup.operatorCount ?? (myGroup.operators || []).length)} operators
                  {myGroup.supervisorName ? ` · Supervised by ${myGroup.supervisorName}` : ""}
                </Text>
              </View>
              {myGroup.supervisorId === user?.id && (
                <View className="bg-primary-soft px-3 py-1 rounded-chip">
                  <Text className="text-xs text-primary font-bold font-inter">You supervise this group</Text>
                </View>
              )}
            </View>

            <View className={isDesktop ? "flex-row gap-6 items-stretch" : "gap-0"}>
              <View className={isDesktop ? "flex-1" : ""}>
                <Card className="mb-4">
                  <Text className="text-base font-bold text-text font-inter mb-3">Supervisor</Text>
                  {supervisor ? (
                    <View className="flex-row items-center gap-3">
                      <Avatar name={fullName(supervisor)} size="sm" />
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-text font-inter">{fullName(supervisor)}</Text>
                        <Text className="text-xs text-text-muted font-inter">{supervisor.email}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text className="text-sm text-text-muted font-inter">No supervisor assigned.</Text>
                  )}
                </Card>
              </View>
              <View className={isDesktop ? "flex-1" : ""}>
                <Card>
                  <Text className="text-base font-bold text-text font-inter mb-3">
                    Operators ({operators.length})
                  </Text>
                  {membersStatus === "loading" && (
                    <View className="gap-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} width="100%" height={48} />
                      ))}
                    </View>
                  )}
                  {membersStatus === "succeeded" && operators.length === 0 && (
                    <EmptyState title="No operators yet" message="Members will appear here once assigned." />
                  )}
                  <View className="gap-2">
                    {operators.map((u) => (
                      <View key={u.id} className="flex-row items-center gap-3 bg-bg rounded-btn px-3 py-2.5">
                        <Avatar name={fullName(u)} size="sm" />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-text font-inter" numberOfLines={1}>
                            {fullName(u)}
                            {myGroup.supervisorId === u.id && (
                              <Text className="text-xs text-primary font-inter"> · Supervisor</Text>
                            )}
                            {u.id === user?.id && (
                              <Text className="text-xs text-text-muted font-inter"> · You</Text>
                            )}
                          </Text>
                          <Text className="text-xs text-text-muted font-inter" numberOfLines={1}>{u.email}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            </View>

            <View className="mt-4">
              <Button title="Back" variant="ghost" size="sm" onPress={() => router.back()} />
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
