namespace DocParsing.Api.Catalog;

/// <summary>
/// Authoritative list of Azure Document Intelligence prebuilt models this
/// service supports for upload and template scoping.
///
/// Adding a model means appending an entry here, then (in the frontend)
/// adding a per-model grouping in <c>web/lib/field-groups.ts</c>. Extraction,
/// matching, and the upload picker all resolve everything they need from
/// this catalog by <see cref="DocumentTypeDefinition.ModelId"/> — there is
/// no other per-model code path.
/// </summary>
public static class DocumentTypeCatalog
{
    public const string DefaultModelId = "prebuilt-invoice";

    private static readonly IReadOnlyList<DocumentTypeDefinition> Entries = new DocumentTypeDefinition[]
    {
        new(
            ModelId: "prebuilt-invoice",
            DisplayName: "Invoice",
            IdentifierFieldPath: "VendorName",
            FlattenMaps: false,
            SampleAssetUrl: null),

        new(
            ModelId: "prebuilt-receipt",
            DisplayName: "Receipt",
            IdentifierFieldPath: "MerchantName",
            FlattenMaps: false,
            SampleAssetUrl: null),

        new(
            ModelId: "prebuilt-tax.us.w2",
            DisplayName: "W-2",
            // The W-2 model returns `Employer` as a Dictionary field with
            // `Name` / `Address` / `IdNumber` children. With FlattenMaps=true
            // the child fields surface as `Employer.Name` etc. so matching
            // can target the employer name directly.
            IdentifierFieldPath: "Employer.Name",
            FlattenMaps: true,
            SampleAssetUrl: null),

        new(
            ModelId: "prebuilt-paystub",
            DisplayName: "Pay Stub",
            // TODO (sub-phase 1B): verify against a real pay stub. The
            // Microsoft sample shows top-level employer fields, but the
            // exact path ("EmployerName" flat vs nested "Employer.Name")
            // needs a parse to confirm before matching relies on it.
            IdentifierFieldPath: "EmployerName",
            FlattenMaps: true,
            SampleAssetUrl: null),

        new(
            ModelId: "prebuilt-bankStatement.us",
            DisplayName: "Bank Statement",
            // TODO (sub-phase 1B): verify identifier field. Likely candidates
            // are `AccountHolderName` (flat) or `Bank.Name` / `Account.Name`
            // (nested). Confirm against a real statement before relying on it.
            IdentifierFieldPath: "AccountHolderName",
            FlattenMaps: true,
            SampleAssetUrl: null),
    };

    public static IReadOnlyList<DocumentTypeDefinition> All => Entries;

    public static DocumentTypeDefinition? Find(string modelId) =>
        Entries.FirstOrDefault(e =>
            e.ModelId.Equals(modelId, StringComparison.OrdinalIgnoreCase));

    public static bool IsSupported(string modelId) =>
        Find(modelId) is not null;
}

/// <summary>
/// Server-internal catalog row. The wire-format projection lives in
/// <see cref="DocParsing.Api.Contracts.DocumentTypeResponse"/>; fields used
/// only by the backend (matching, flatten flag) are intentionally omitted
/// from that DTO.
/// </summary>
public record DocumentTypeDefinition(
    string ModelId,
    string DisplayName,
    string IdentifierFieldPath,
    bool FlattenMaps,
    string? SampleAssetUrl);
