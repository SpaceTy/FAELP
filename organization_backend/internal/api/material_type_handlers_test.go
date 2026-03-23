package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
