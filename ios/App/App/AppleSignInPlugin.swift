import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        guard pendingCall == nil else {
            call.reject("Another Apple sign-in request is already running.", "APPLE_SIGN_IN_BUSY")
            return
        }
        guard let rawNonce = call.getString("nonce"), !rawNonce.isEmpty else {
            call.reject("A nonce is required.", "APPLE_NONCE_REQUIRED")
            return
        }

        pendingCall = call
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(rawNonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            finishWithError("Apple did not return an identity token.", code: "APPLE_TOKEN_MISSING")
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user
        ]
        if let authorizationCode = credential.authorizationCode.flatMap({ String(data: $0, encoding: .utf8) }) {
            result["authorizationCode"] = authorizationCode
        }
        if let email = credential.email { result["email"] = email }
        if let fullName = credential.fullName {
            result["givenName"] = fullName.givenName
            result["familyName"] = fullName.familyName
        }
        pendingCall?.resolve(result)
        pendingCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let authorizationError = error as? ASAuthorizationError
        let code = authorizationError?.code == .canceled ? "APPLE_SIGN_IN_CANCELED" : "APPLE_SIGN_IN_FAILED"
        finishWithError(error.localizedDescription, code: code)
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    private func sha256(_ value: String) -> String {
        let digest = SHA256.hash(data: Data(value.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func finishWithError(_ message: String, code: String) {
        pendingCall?.reject(message, code)
        pendingCall = nil
    }
}
