package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"organization_backend/internal/domain"
)

type materialTypeHandlerStoreStub struct{}

func (materialTypeHandlerStoreStub) ListMaterialTypes(context.Context) ([]domain.MaterialType, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) ListMaterialTypesWithAvailability(context.Context) ([]domain.MaterialType, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) GetMaterialTypeByID(context.Context, string) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) CreateMaterialType(context.Context, string, string, string, string, domain.MaterialCategory) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) UpdateMaterialType(context.Context, string, string, string, domain.MaterialCategory) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) UpdateMaterialTypeImage(context.Context, string, string) error {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) DeleteMaterialType(context.Context, string) error {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) UpdateMaterialAvailability(context.Context, string, map[string]int) error {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) ListDistributionCenters(context.Context) ([]domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) GetDistributionCenterByID(context.Context, string) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) GetDistributionCenterBySocketPath(context.Context, string) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) CreateDistributionCenter(context.Context, domain.CreateDistributionCenterInput) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) CreateDistributionCenterWithSocket(context.Context, string, string, string) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) UpdateDistributionCenter(context.Context, string, domain.UpdateDistributionCenterInput) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (materialTypeHandlerStoreStub) DeleteDistributionCenter(context.Context, string) error {
	panic("unexpected call")
}

type materialTypeHandlerDistClientStub struct {
	mu       sync.Mutex
	calls    int
	response map[string]int
}

func (s *materialTypeHandlerDistClientStub) GetAvailableMaterials(context.Context) (map[string]int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.calls++
	result := make(map[string]int, len(s.response))
	for key, value := range s.response {
		result[key] = value
	}
	return result, nil
}

func (s *materialTypeHandlerDistClientStub) CallCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls
}

type materialTypeHandlerCacheStoreStub struct {
	mu                   sync.Mutex
	listResults          [][]domain.MaterialType
	listWithAvailCalls   int
	updateAvailCalls     int
	getSocketLookupCalls int
	refreshSignals       chan struct{}
}

func (s *materialTypeHandlerCacheStoreStub) ListMaterialTypes(context.Context) ([]domain.MaterialType, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) ListMaterialTypesWithAvailability(context.Context) ([]domain.MaterialType, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := s.listWithAvailCalls
	s.listWithAvailCalls++
	if s.refreshSignals != nil {
		select {
		case s.refreshSignals <- struct{}{}:
		default:
		}
	}
	if len(s.listResults) == 0 {
		return []domain.MaterialType{}, nil
	}
	if index >= len(s.listResults) {
		index = len(s.listResults) - 1
	}
	return cloneMaterialTypes(s.listResults[index]), nil
}

func (s *materialTypeHandlerCacheStoreStub) GetMaterialTypeByID(context.Context, string) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) CreateMaterialType(context.Context, string, string, string, string, domain.MaterialCategory) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) UpdateMaterialType(context.Context, string, string, string, domain.MaterialCategory) (domain.MaterialType, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) UpdateMaterialTypeImage(context.Context, string, string) error {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) DeleteMaterialType(context.Context, string) error {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) UpdateMaterialAvailability(context.Context, string, map[string]int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.updateAvailCalls++
	return nil
}

func (s *materialTypeHandlerCacheStoreStub) ListDistributionCenters(context.Context) ([]domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) GetDistributionCenterByID(context.Context, string) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) GetDistributionCenterBySocketPath(context.Context, string) (domain.DistributionCenter, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.getSocketLookupCalls++
	return domain.DistributionCenter{ID: "dc-1"}, nil
}

func (s *materialTypeHandlerCacheStoreStub) CreateDistributionCenter(context.Context, domain.CreateDistributionCenterInput) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) CreateDistributionCenterWithSocket(context.Context, string, string, string) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) UpdateDistributionCenter(context.Context, string, domain.UpdateDistributionCenterInput) (domain.DistributionCenter, error) {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) DeleteDistributionCenter(context.Context, string) error {
	panic("unexpected call")
}

func (s *materialTypeHandlerCacheStoreStub) Counts() (listCalls, updateCalls, lookupCalls int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.listWithAvailCalls, s.updateAvailCalls, s.getSocketLookupCalls
}

func decodeMaterialTypesResponse(t *testing.T, body string) []domain.MaterialType {
	t.Helper()

	var materials []domain.MaterialType
	if err := json.Unmarshal([]byte(body), &materials); err != nil {
		t.Fatalf("failed to decode material types response: %v", err)
	}
	return materials
}

func TestCreateMaterialTypeRejectsMissingCategory(t *testing.T) {
	handler := &MaterialTypeHandler{Store: materialTypeHandlerStoreStub{}}
	req := httptest.NewRequest(http.MethodPost, "/api/material-types", strings.NewReader(`{"name":"AED Trainer","description":"CPR trainer"}`))
	rr := httptest.NewRecorder()

	handler.CreateMaterialType(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Category is required") {
		t.Fatalf("expected category validation error, got %s", rr.Body.String())
	}
}

func TestCreateMaterialTypeRejectsInvalidCategory(t *testing.T) {
	handler := &MaterialTypeHandler{Store: materialTypeHandlerStoreStub{}}
	req := httptest.NewRequest(http.MethodPost, "/api/material-types", strings.NewReader(`{"name":"AED Trainer","description":"CPR trainer","category":"Invalid"}`))
	rr := httptest.NewRecorder()

	handler.CreateMaterialType(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "Category is invalid") {
		t.Fatalf("expected invalid category error, got %s", rr.Body.String())
	}
}

func TestListMaterialTypesCachesResultsWithinTTL(t *testing.T) {
	baseTime := time.Date(2026, time.March, 23, 16, 0, 0, 0, time.UTC)
	currentTime := baseTime
	store := &materialTypeHandlerCacheStoreStub{
		listResults: [][]domain.MaterialType{
			{{ID: "first", Name: "First"}},
			{{ID: "second", Name: "Second"}},
		},
	}
	distClient := &materialTypeHandlerDistClientStub{
		response: map[string]int{"first": 3},
	}
	handler := &MaterialTypeHandler{
		Store:      store,
		DistClient: distClient,
		SocketPath: "/tmp/dist.sock",
		CacheTTL:   30 * time.Second,
		now: func() time.Time {
			return currentTime
		},
	}

	firstReq := httptest.NewRequest(http.MethodGet, "/api/material-types", nil)
	firstRR := httptest.NewRecorder()
	handler.ListMaterialTypes(firstRR, firstReq)

	currentTime = currentTime.Add(10 * time.Second)
	secondReq := httptest.NewRequest(http.MethodGet, "/api/material-types", nil)
	secondRR := httptest.NewRecorder()
	handler.ListMaterialTypes(secondRR, secondReq)

	if firstRR.Code != http.StatusOK || secondRR.Code != http.StatusOK {
		t.Fatalf("expected both requests to succeed, got %d and %d", firstRR.Code, secondRR.Code)
	}

	firstBody := decodeMaterialTypesResponse(t, firstRR.Body.String())
	secondBody := decodeMaterialTypesResponse(t, secondRR.Body.String())
	if len(firstBody) != 1 || len(secondBody) != 1 || firstBody[0].ID != "first" || secondBody[0].ID != "first" {
		t.Fatalf("expected cached material types to be reused, got %v and %v", firstBody, secondBody)
	}

	listCalls, updateCalls, lookupCalls := store.Counts()
	if listCalls != 1 || updateCalls != 1 || lookupCalls != 1 {
		t.Fatalf("expected one refresh within TTL, got list=%d update=%d lookup=%d", listCalls, updateCalls, lookupCalls)
	}
	if distClient.CallCount() != 1 {
		t.Fatalf("expected one dist refresh within TTL, got %d", distClient.CallCount())
	}
}

func TestListMaterialTypesRefreshesInBackgroundAfterTTL(t *testing.T) {
	baseTime := time.Date(2026, time.March, 23, 16, 0, 0, 0, time.UTC)
	currentTime := baseTime
	store := &materialTypeHandlerCacheStoreStub{
		listResults: [][]domain.MaterialType{
			{{ID: "first", Name: "First"}},
			{{ID: "second", Name: "Second"}},
		},
		refreshSignals: make(chan struct{}, 2),
	}
	distClient := &materialTypeHandlerDistClientStub{
		response: map[string]int{"first": 3},
	}
	handler := &MaterialTypeHandler{
		Store:      store,
		DistClient: distClient,
		SocketPath: "/tmp/dist.sock",
		CacheTTL:   30 * time.Second,
		now: func() time.Time {
			return currentTime
		},
	}

	firstReq := httptest.NewRequest(http.MethodGet, "/api/material-types", nil)
	firstRR := httptest.NewRecorder()
	handler.ListMaterialTypes(firstRR, firstReq)
	if firstRR.Code != http.StatusOK {
		t.Fatalf("expected cold cache request to succeed, got %d", firstRR.Code)
	}

	currentTime = currentTime.Add(31 * time.Second)
	secondReq := httptest.NewRequest(http.MethodGet, "/api/material-types", nil)
	secondRR := httptest.NewRecorder()
	handler.ListMaterialTypes(secondRR, secondReq)
	if secondRR.Code != http.StatusOK {
		t.Fatalf("expected stale cache request to succeed, got %d", secondRR.Code)
	}

	secondBody := decodeMaterialTypesResponse(t, secondRR.Body.String())
	if len(secondBody) != 1 || secondBody[0].ID != "first" {
		t.Fatalf("expected stale response during background refresh, got %v", secondBody)
	}

	select {
	case <-store.refreshSignals:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for background refresh")
	}
	select {
	case <-store.refreshSignals:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for second refresh completion")
	}

	thirdReq := httptest.NewRequest(http.MethodGet, "/api/material-types", nil)
	thirdRR := httptest.NewRecorder()
	handler.ListMaterialTypes(thirdRR, thirdReq)
	if thirdRR.Code != http.StatusOK {
		t.Fatalf("expected refreshed cache request to succeed, got %d", thirdRR.Code)
	}

	thirdBody := decodeMaterialTypesResponse(t, thirdRR.Body.String())
	if len(thirdBody) != 1 || thirdBody[0].ID != "second" {
		t.Fatalf("expected refreshed material types after TTL, got %v", thirdBody)
	}

	listCalls, updateCalls, lookupCalls := store.Counts()
	if listCalls != 2 || updateCalls != 2 || lookupCalls != 2 {
		t.Fatalf("expected two refresh cycles, got list=%d update=%d lookup=%d", listCalls, updateCalls, lookupCalls)
	}
	if distClient.CallCount() != 2 {
		t.Fatalf("expected two dist refreshes, got %d", distClient.CallCount())
	}
}
